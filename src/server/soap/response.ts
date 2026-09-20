import { escapeXml } from "./serialize";

const SOAP_ENVELOPE_NAMESPACE = "http://schemas.xmlsoap.org/soap/envelope/";

/** SIMULATOR_INTERNAL local SOAP 1.1 response serialization profile. */
export function serializePayResponse(result: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_ENVELOPE_NAMESPACE}"><soap:Body><bpPayRequestResponse><bpPayRequestResult>${escapeXml(result)}</bpPayRequestResult></bpPayRequestResponse></soap:Body></soap:Envelope>`;
}

/** SIMULATOR_INTERNAL local SOAP 1.1 response serialization profile. */
export function serializeVerifyResponse(result: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_ENVELOPE_NAMESPACE}"><soap:Body><bpVerifyRequestResponse><bpVerifyRequestResult>${escapeXml(result)}</bpVerifyRequestResult></bpVerifyRequestResponse></soap:Body></soap:Envelope>`;
}

/** SIMULATOR_INTERNAL local SOAP 1.1 response serialization profile. */
export function serializeSettleResponse(result: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_ENVELOPE_NAMESPACE}"><soap:Body><bpSettleRequestResponse><bpSettleRequestResult>${escapeXml(result)}</bpSettleRequestResult></bpSettleRequestResponse></soap:Body></soap:Envelope>`;
}

/** SIMULATOR_INTERNAL local SOAP 1.1 response serialization profile. */
export function serializeVerifySettleResponse(result: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_ENVELOPE_NAMESPACE}"><soap:Body><bpVerifySettleRequestResponse><bpVerifySettleRequestResult>${escapeXml(result)}</bpVerifySettleRequestResult></bpVerifySettleRequestResponse></soap:Body></soap:Envelope>`;
}

/** SIMULATOR_INTERNAL local fault representation; never Behpardakht ResCode. */
export function serializeSoapFault(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${SOAP_ENVELOPE_NAMESPACE}"><soap:Body><soap:Fault><faultcode>${escapeXml(code)}</faultcode><faultstring>${escapeXml(message)}</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
}
