const BOUNDARY = "z83TestBoundary";

export function buildMultipartPayload(
  fields: Record<string, string>,
  file: { fieldName: string; filename: string; contentType: string; content: Buffer },
): { body: Buffer; contentType: string } {
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    ),
    file.content,
    Buffer.from("\r\n"),
  );

  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));

  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${BOUNDARY}` };
}
