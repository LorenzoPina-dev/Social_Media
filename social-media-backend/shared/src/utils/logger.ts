/**
 * Shared Logger Factory
 * Creates a structured Winston logger for a given service name.
 */

import winston from 'winston';

const { combine, timestamp, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  let msg = `${ts} [${level}] : ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

/**
 * Create a logger instance for a specific service.
 *
 * @param serviceName - Name used in the `service` default-meta field.
 * @param logLevel    - Winston log level (defaults to env `LOG_LEVEL` or `'info'`).
 */
export function createLogger(
  serviceName: string,
  logLevel?: string,
): winston.Logger {
  const env = process.env.NODE_ENV ?? 'development';
  const level = logLevel ?? process.env.LOG_LEVEL ?? 'info';

  return winston.createLogger({
    level,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
    defaultMeta: { service: serviceName, environment: env },
    transports: [
      new winston.transports.Console({
        format:
          env === 'development'
            ? combine(colorize(), timestamp(), devFormat)
            : combine(timestamp(), json()),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5_242_880,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5_242_880,
        maxFiles: 5,
      }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
  });
}
