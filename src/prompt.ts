/**
 * Build a structured prompt with clear separation of system instructions
 * from user data. Uses XML-style delimiters for robustness.
 */

export type StructuredPromptInput = {
  system: string;
  userData: string;
  context?: string;
};

const USER_DATA_START = '<user_data>';
const USER_DATA_END = '</user_data>';
const CONTEXT_START = '<context>';
const CONTEXT_END = '</context>';

/**
 * Build a structured prompt with instruction/data separation.
 * System instructions remain separate; user data is wrapped in delimiters.
 */
export function buildStructuredPrompt(input: StructuredPromptInput): string {
  const parts: string[] = [input.system];

  if (input.context?.trim()) {
    parts.push(`${CONTEXT_START}\n${input.context.trim()}\n${CONTEXT_END}`);
  }

  parts.push(`${USER_DATA_START}\n${input.userData.trim()}\n${USER_DATA_END}`);

  return parts.join('\n\n');
}

/**
 * Build messages array for SDK consumers (system + user).
 */
export function buildMessages(input: StructuredPromptInput): Array<{ role: 'user' | 'system'; content: string }> {
  const systemParts: string[] = [input.system];
  if (input.context?.trim()) {
    systemParts.push(`${CONTEXT_START}\n${input.context.trim()}\n${CONTEXT_END}`);
  }

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    { role: 'user', content: input.userData.trim() },
  ];
}
