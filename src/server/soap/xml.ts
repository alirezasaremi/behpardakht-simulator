import { SaxesParser, type SaxesTagNS } from "saxes";
import { SoapInputError } from "./errors";

export const MAX_SOAP_REQUEST_BYTES = 65_536;
const MAX_XML_DEPTH = 32;
const MAX_XML_NODES = 256;
const SOAP_1_1_ENVELOPE_NAMESPACE = "http://schemas.xmlsoap.org/soap/envelope/";

type XmlNode = {
  localName: string;
  namespaceUri: string;
  children: XmlNode[];
  text: string;
};

export type ParsedSoapOperation = Readonly<{
  name: string;
  fields: ReadonlyMap<string, string>;
}>;

/**
 * SIMULATOR_INTERNAL local compatibility profile: SOAP 1.1 Envelope/Body and
 * a single direct operation element. Operation matching ignores its prefix/URI.
 */
export function parseLocalSoapOperation(xml: string): ParsedSoapOperation {
  const root = parseXml(xml);
  if (root.localName !== "Envelope" || root.namespaceUri !== SOAP_1_1_ENVELOPE_NAMESPACE) {
    throw new SoapInputError("UNSUPPORTED_ENVELOPE", "Local service requires a SOAP 1.1 Envelope.");
  }
  for (const child of root.children) {
    const isSoapHeaderOrBody =
      child.namespaceUri === SOAP_1_1_ENVELOPE_NAMESPACE &&
      (child.localName === "Header" || child.localName === "Body");
    if (!isSoapHeaderOrBody) {
      throw new SoapInputError("UNSUPPORTED_ENVELOPE", "SOAP Envelope contains an unsupported element.");
    }
  }

  const body = uniqueChild(root, "Body", SOAP_1_1_ENVELOPE_NAMESPACE, "UNSUPPORTED_ENVELOPE");
  if (body.children.length !== 1 || body.children[0] === undefined) {
    throw new SoapInputError("UNSUPPORTED_ENVELOPE", "SOAP Body must contain exactly one operation.");
  }

  const operation = body.children[0];
  const fields = new Map<string, string>();
  for (const field of operation.children) {
    if (field.children.length > 0 || fields.has(field.localName)) {
      throw new SoapInputError("INVALID_PAY_REQUEST", "SOAP operation fields must be unique text elements.");
    }
    fields.set(field.localName, field.text);
  }

  return { name: operation.localName, fields };
}

function parseXml(xml: string): XmlNode {
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let nodeCount = 0;

  const parser = new SaxesParser({ xmlns: true, position: false });
  parser.on("doctype", () => {
    throw new SoapInputError("DTD_NOT_ALLOWED", "DTD declarations are not allowed.");
  });
  parser.on("processinginstruction", () => {
    throw new SoapInputError("MALFORMED_XML", "Processing instructions are not allowed.");
  });
  parser.on("error", () => {
    throw new SoapInputError("MALFORMED_XML", "Malformed XML.");
  });
  parser.on("opentag", (tag: SaxesTagNS) => {
    nodeCount += 1;
    if (nodeCount > MAX_XML_NODES || stack.length >= MAX_XML_DEPTH) {
      throw new SoapInputError("MALFORMED_XML", "XML structure exceeds local safety limits.");
    }
    const node: XmlNode = { localName: tag.local, namespaceUri: tag.uri, children: [], text: "" };
    const parent = stack.at(-1);
    if (parent === undefined) {
      if (root !== undefined) {
        throw new SoapInputError("MALFORMED_XML", "XML must have one root element.");
      }
      root = node;
    } else {
      parent.children.push(node);
    }
    stack.push(node);
  });
  parser.on("text", (text) => appendText(stack, text));
  parser.on("cdata", (text) => appendText(stack, text));
  parser.on("closetag", () => {
    stack.pop();
  });

  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof SoapInputError) {
      throw error;
    }
    throw new SoapInputError("MALFORMED_XML", "Malformed XML.");
  }

  if (root === undefined || stack.length !== 0) {
    throw new SoapInputError("MALFORMED_XML", "Malformed XML.");
  }
  return root;
}

function appendText(stack: XmlNode[], text: string): void {
  const node = stack.at(-1);
  if (node === undefined) {
    if (text.trim().length > 0) {
      throw new SoapInputError("MALFORMED_XML", "Text outside XML root is not allowed.");
    }
    return;
  }
  node.text += text;
}

function uniqueChild(
  parent: XmlNode,
  localName: string,
  namespaceUri: string,
  errorCode: "UNSUPPORTED_ENVELOPE",
): XmlNode {
  const matches = parent.children.filter((child) => child.localName === localName && child.namespaceUri === namespaceUri);
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new SoapInputError(errorCode, `SOAP Envelope requires one ${localName}.`);
  }
  return matches[0];
}
