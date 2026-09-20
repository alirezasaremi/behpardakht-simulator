import { SystemClock, RandomIdentifierGenerator, InMemoryTransactionRepository } from "@/server/transactions";
import {
  BpPayRequestApplicationError,
  BpPayRequestHandler,
  RandomRefIdGenerator,
  type BpPayRequestHandlerDependencies,
} from "@/server/protocol";
import { SoapInputError } from "./errors";
import { extractBpPayRequest } from "./pay-request";
import { serializePayResponse, serializeSoapFault } from "./response";
import { MAX_SOAP_REQUEST_BYTES, parseLocalSoapOperation } from "./xml";

export type LocalSoapServiceDependencies = BpPayRequestHandlerDependencies;

/** SIMULATOR_INTERNAL local HTTP/SOAP adapter. */
export class LocalSoapService {
  readonly repository;
  private readonly payRequests: BpPayRequestHandler;

  constructor(dependencies: LocalSoapServiceDependencies) {
    this.repository = dependencies.repository;
    this.payRequests = new BpPayRequestHandler(dependencies);
  }

  async handle(request: Request): Promise<Response> {
    try {
      const body = await readBoundedRequestBody(request, MAX_SOAP_REQUEST_BYTES);
      const operation = parseLocalSoapOperation(body);
      const input = extractBpPayRequest(operation);
      const result = this.payRequests.execute(input);
      return xmlResponse(serializePayResponse(result.result), 200);
    } catch (error) {
      if (error instanceof BpPayRequestApplicationError && error.code === "DUPLICATE_PAY_ORDER_ID") {
        return xmlResponse(
          serializeSoapFault("Client.DuplicatePayOrderId", "Duplicate Pay orderId is not accepted by local simulator."),
          409,
        );
      }
      if (error instanceof SoapInputError) {
        return xmlResponse(serializeSoapFault("Client", safeFaultMessage(error.code)), 400);
      }
      return xmlResponse(serializeSoapFault("Server", "Simulator internal failure."), 500);
    }
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
