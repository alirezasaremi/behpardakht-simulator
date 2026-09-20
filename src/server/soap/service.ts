import { SystemClock, RandomIdentifierGenerator, InMemoryTransactionRepository } from "@/server/transactions";
import type { ScenarioPolicy } from "@/server/scenarios";
import type { TransportFaultAssignment, TransportFaultEngine, TransportFaultOperation } from "@/server/transport";
import {
  BpPayRequestApplicationError,
  BpPayRequestHandler,
  BpCumulativeDynamicPayRequestHandler,
  BpCumulativeDynamicPayRequestApplicationError,
  BpDynamicPayRequestHandler,
  BpDynamicPayRequestApplicationError,
  BpInquiryRequestApplicationError,
  BpInquiryRequestHandler,
  BpReversalRequestApplicationError,
  BpReversalRequestHandler,
  BpSettleRequestApplicationError,
  BpSettleRequestHandler,
  BpVerifyRequestApplicationError,
  BpVerifyRequestHandler,
  BpVerifySettleRequestApplicationError,
  BpVerifySettleRequestHandler,
  RandomRefIdGenerator,
  type BpPayRequestHandlerDependencies,
} from "@/server/protocol";
import { SoapInputError } from "./errors";
import { extractBpPayRequest } from "./pay-request";
import { extractBpCumulativeDynamicPayRequest } from "./cumulative-dynamic-pay-request";
import { extractBpDynamicPayRequest } from "./dynamic-pay-request";
import {
  serializePayResponse,
  serializeCumulativeDynamicPayResponse,
  serializeDynamicPayResponse,
  serializeSettleResponse,
  serializeSoapFault,
  serializeVerifyResponse,
  serializeVerifySettleResponse,
} from "./response";
import { extractBpInquiryRequest } from "./inquiry-request";
import { extractBpReversalRequest } from "./reversal-request";
import { extractBpSettleRequest } from "./settle-request";
import { extractBpVerifyRequest } from "./verify-request";
import { extractBpVerifySettleRequest } from "./verify-settle-request";
import { MAX_SOAP_REQUEST_BYTES, parseLocalSoapOperation } from "./xml";

export type LocalSoapServiceDependencies = BpPayRequestHandlerDependencies & Readonly<{
  scenarios?: ScenarioPolicy;
  transportFaults?: TransportFaultEngine;
  wait?: (milliseconds: number) => Promise<void>;
}>;

/** SIMULATOR_SCENARIO fixed delay; no caller-configured duration exists. */
export const POST_EXECUTION_DELAY_MILLISECONDS = 250;
const MALFORMED_SOAP_RESPONSE = "<simulator-malformed-soap";

/** SIMULATOR_INTERNAL local HTTP/SOAP adapter. */
export class LocalSoapService {
  readonly repository;
  private readonly payRequests: BpPayRequestHandler;
  private readonly cumulativeDynamicPayRequests: BpCumulativeDynamicPayRequestHandler;
  private readonly dynamicPayRequests: BpDynamicPayRequestHandler;
  private readonly inquiryRequests: BpInquiryRequestHandler;
  private readonly reversalRequests: BpReversalRequestHandler;
  private readonly settleRequests: BpSettleRequestHandler;
  private readonly verifyRequests: BpVerifyRequestHandler;
  private readonly verifySettleRequests: BpVerifySettleRequestHandler;
  private readonly transportFaults: TransportFaultEngine | undefined;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(dependencies: LocalSoapServiceDependencies) {
    this.repository = dependencies.repository;
    this.payRequests = new BpPayRequestHandler(dependencies);
    this.cumulativeDynamicPayRequests = new BpCumulativeDynamicPayRequestHandler(dependencies);
    this.dynamicPayRequests = new BpDynamicPayRequestHandler(dependencies);
    this.inquiryRequests = new BpInquiryRequestHandler(dependencies);
    this.reversalRequests = new BpReversalRequestHandler(dependencies);
    this.settleRequests = new BpSettleRequestHandler(dependencies);
    this.verifyRequests = new BpVerifyRequestHandler(dependencies);
    this.verifySettleRequests = new BpVerifySettleRequestHandler(dependencies);
    this.transportFaults = dependencies.transportFaults;
    this.wait = dependencies.wait ?? delay;
  }

  async handle(request: Request): Promise<Response> {
    try {
      const body = await readBoundedRequestBody(request, MAX_SOAP_REQUEST_BYTES);
      const operation = parseLocalSoapOperation(body);
      if (operation.name === "bpPayRequest") {
        const result = this.payRequests.execute(extractBpPayRequest(operation));
        return xmlResponse(serializePayResponse(result.result), 200);
      }
      if (operation.name === "bpCumulativeDynamicPayRequest") {
        const result = this.cumulativeDynamicPayRequests.execute(extractBpCumulativeDynamicPayRequest(operation));
        return xmlResponse(serializeCumulativeDynamicPayResponse(result.result), 200);
      }
      if (operation.name === "bpDynamicPayRequest") {
        const result = this.dynamicPayRequests.execute(extractBpDynamicPayRequest(operation));
        return xmlResponse(serializeDynamicPayResponse(result.result), 200);
      }
      if (operation.name === "bpVerifyRequest") {
        const input = extractBpVerifyRequest(operation);
        return await this.executeTransportAware("bpVerifyRequest", input, () => {
          const result = this.verifyRequests.execute(input);
          return { transaction: result.transaction, response: xmlResponse(serializeVerifyResponse(result.result), 200) };
        });
      }
      if (operation.name === "bpSettleRequest") {
        const input = extractBpSettleRequest(operation);
        return await this.executeTransportAware("bpSettleRequest", input, () => {
          const result = this.settleRequests.execute(input);
          return { transaction: result.transaction, response: xmlResponse(serializeSettleResponse(result.result), 200) };
        });
      }
      if (operation.name === "bpVerifySettleRequest") {
        const input = extractBpVerifySettleRequest(operation);
        return await this.executeTransportAware("bpVerifySettleRequest", input, () => {
          const result = this.verifySettleRequests.execute(input);
          return { transaction: result.transaction, response: xmlResponse(serializeVerifySettleResponse(result.result), 200) };
        });
      }
      if (operation.name === "bpInquiryRequest") {
        this.inquiryRequests.execute(extractBpInquiryRequest(operation));
      }
      if (operation.name === "bpReversalRequest") {
        this.reversalRequests.execute(extractBpReversalRequest(operation));
      }
      throw new SoapInputError("UNSUPPORTED_OPERATION", "Unsupported SOAP operation.");
    } catch (error) {
      if (error instanceof BpCumulativeDynamicPayRequestApplicationError && error.code === "DUPLICATE_CUMULATIVE_DYNAMIC_PAY_ORDER_ID") {
        return xmlResponse(
          serializeSoapFault("Client.DuplicateCumulativeDynamicPayOrderId", "Duplicate Cumulative Dynamic Pay orderId is not accepted by local simulator."),
          409,
        );
      }
      if (error instanceof BpDynamicPayRequestApplicationError && error.code === "DUPLICATE_DYNAMIC_PAY_ORDER_ID") {
        return xmlResponse(
          serializeSoapFault("Client.DuplicateDynamicPayOrderId", "Duplicate Dynamic Pay orderId is not accepted by local simulator."),
          409,
        );
      }
      if (error instanceof BpPayRequestApplicationError && error.code === "DUPLICATE_PAY_ORDER_ID") {
        return xmlResponse(
          serializeSoapFault("Client.DuplicatePayOrderId", "Duplicate Pay orderId is not accepted by local simulator."),
          409,
        );
      }
      if (error instanceof BpVerifyRequestApplicationError) {
        if (error.code === "VERIFY_UNRESOLVED_SCENARIO") {
          return xmlResponse(
            serializeSoapFault("SimulatorScenario.VerifyUnresolved", "Verify outcome remains unresolved by local scenario."),
            409,
          );
        }
        return xmlResponse(
          serializeSoapFault("Client.InvalidVerifyRequest", "Verify request cannot be completed by local simulator."),
          400,
        );
      }
      if (error instanceof BpSettleRequestApplicationError) {
        return xmlResponse(
          serializeSoapFault("Client.InvalidSettleRequest", "Settle request cannot be completed by local simulator."),
          400,
        );
      }
      if (error instanceof BpVerifySettleRequestApplicationError) {
        return xmlResponse(
          serializeSoapFault("Client.InvalidVerifySettleRequest", "VerifySettle request cannot be completed by local simulator."),
          400,
        );
      }
      if (error instanceof BpInquiryRequestApplicationError) {
        return xmlResponse(
          serializeSoapFault("Client.InvalidInquiryRequest", "Inquiry request cannot be completed by local simulator."),
          400,
        );
      }
      if (error instanceof BpReversalRequestApplicationError) {
        return xmlResponse(
          serializeSoapFault("Client.InvalidReversalRequest", "Reversal request cannot be completed by local simulator."),
          400,
        );
      }
      if (error instanceof SoapInputError) {
        return xmlResponse(serializeSoapFault("Client", safeFaultMessage(error.code)), 400);
      }
      return xmlResponse(serializeSoapFault("Server", "Simulator internal failure."), 500);
    }
  }

  private async executeTransportAware(
    operation: TransportFaultOperation,
    input: Readonly<{ terminalId: bigint; saleOrderId: bigint; saleReferenceId: bigint }>,
    execute: () => Readonly<{ transaction: import("@/server/transactions").Transaction; response: Response }>,
  ): Promise<Response> {
    const transaction = this.repository.getByProtocolCorrelation(input);
    if (transaction !== undefined && this.transportFaults?.claimPreExecution(transaction, operation) !== undefined) {
      return transportHttpFailure();
    }

    const completed = execute();
    const fault = this.transportFaults?.claimPostExecution(completed.transaction, operation);
    return this.applyPostExecutionFault(completed.response, fault);
  }

  private async applyPostExecutionFault(response: Response, fault: TransportFaultAssignment | undefined): Promise<Response> {
    if (fault === undefined) {
      return response;
    }
    if (fault.profile === "POST_EXECUTION_HTTP_FAILURE") {
      return transportHttpFailure();
    }
    if (fault.profile === "POST_EXECUTION_MALFORMED_SOAP") {
      return new Response(MALFORMED_SOAP_RESPONSE, {
        status: 200,
        headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (fault.profile === "POST_EXECUTION_DELAY") {
      await this.wait(POST_EXECUTION_DELAY_MILLISECONDS);
    }
    return response;
  }
}

export function createLocalSoapService(
  dependencies: LocalSoapServiceDependencies = {
    repository: new InMemoryTransactionRepository(),
    clock: new SystemClock(),
    identifiers: new RandomIdentifierGenerator(),
    refIds: new RandomRefIdGenerator(),
  },
): LocalSoapService {
  return new LocalSoapService(dependencies);
}

async function readBoundedRequestBody(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new SoapInputError("REQUEST_TOO_LARGE", "SOAP request exceeds local size limit.");
  }
  if (request.body === null) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new SoapInputError("REQUEST_TOO_LARGE", "SOAP request exceeds local size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new SoapInputError("MALFORMED_XML", "SOAP request is not valid UTF-8 XML.");
  }
}

function xmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
  });
}

function transportHttpFailure(): Response {
  return new Response("Simulator transport failure.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeFaultMessage(code: SoapInputError["code"]): string {
  if (code === "REQUEST_TOO_LARGE") {
    return "SOAP request exceeds local size limit.";
  }
  if (code === "DTD_NOT_ALLOWED") {
    return "DTD declarations are not allowed.";
  }
  if (code === "UNSUPPORTED_OPERATION") {
    return "Unsupported SOAP operation.";
  }
  return "Malformed or invalid SOAP request.";
}
