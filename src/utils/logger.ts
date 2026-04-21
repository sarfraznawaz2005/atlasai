const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

export const logger = {
  info(message: string): void {
    console.log(`${CYAN}[agent-atlas]${RESET} ${message}`);
  },

  success(message: string): void {
    console.log(`${GREEN}[agent-atlas]${RESET} ${BOLD}${message}${RESET}`);
  },

  warn(message: string): void {
    console.warn(`${YELLOW}[agent-atlas]${RESET} ${YELLOW}Warning:${RESET} ${message}`);
  },

  error(message: string): void {
    console.error(`${RED}[agent-atlas]${RESET} ${RED}Error:${RESET} ${message}`);
  },

  debug(message: string): void {
    if (process.env.ATLAS_DEBUG) {
      console.log(`${GRAY}[atlas:debug]${RESET} ${DIM}${message}${RESET}`);
    }
  },

  step(step: string, detail: string): void {
    console.log(`${BLUE}[agent-atlas]${RESET} ${BOLD}${step}${RESET} ${detail}`);
  },

  summary(lines: string[]): void {
    console.log('');
    console.log(`${GREEN}${BOLD}Atlas generation complete${RESET}`);
    for (const line of lines) {
      console.log(`  ${CYAN}>${RESET} ${line}`);
    }
    console.log('');
  },
};
