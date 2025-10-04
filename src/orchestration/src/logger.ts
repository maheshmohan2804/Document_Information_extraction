/**
 * Logger module for tracking all processes in the corrective RAG system
 * Logs to both console and file with timestamps and log levels
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

class Logger {
  private logFilePath: string;
  private logStream: fs.WriteStream;

  constructor(logDirectory: string = './logs') {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logDirectory, `rag-${timestamp}.log`);

    // Create write stream for logging
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });

    this.log(LogLevel.INFO, `Logger initialized. Log file: ${this.logFilePath}`);
  }

  /**
   * Main logging method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    // Write to file
    this.logStream.write(logMessage + '\n');

    if (data) {
      const dataString = typeof data === 'object'
        ? JSON.stringify(data, null, 2)
        : String(data);
      this.logStream.write(`  Data: ${dataString}\n`);
    }

    // Write to console with color coding
    const consoleMessage = this.formatConsoleMessage(level, message);
    console.log(consoleMessage);

    if (data) {
      console.log('  Data:', data);
    }
  }

  /**
   * Format console message with appropriate prefixes
   */
  private formatConsoleMessage(level: LogLevel, message: string): string {
    const prefixes: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '[DEBUG]',
      [LogLevel.INFO]: '[INFO]',
      [LogLevel.WARN]: '[WARN]',
      [LogLevel.ERROR]: '[ERROR]',
      [LogLevel.SUCCESS]: '[SUCCESS]'
    };

    return `${prefixes[level]} ${message}`;
  }

  /**
   * Log debug information
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log informational messages
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warnings
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log errors
   */
  error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);

    if (error && error.stack) {
      this.logStream.write(`  Stack: ${error.stack}\n`);
    }
  }

  /**
   * Log success messages
   */
  success(message: string, data?: any): void {
    this.log(LogLevel.SUCCESS, message, data);
  }

  /**
   * Log separator line for readability
   */
  separator(char: string = '=', length: number = 80): void {
    const line = char.repeat(length);
    this.logStream.write(line + '\n');
    console.log(line);
  }

  /**
   * Log section header
   */
  section(title: string): void {
    this.separator('=');
    this.info(title);
    this.separator('=');
  }

  /**
   * Close the log stream
   */
  close(): void {
    this.info('Logger closing');
    this.logStream.end();
  }

  /**
   * Get the log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
}

// Export singleton instance
export const logger = new Logger();
