/**
 * Logger — Winston structured JSON
 */

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  let line = `${ts} [${level}] ${message}`;
  if (Object.keys(meta).length > 0) line += ` ${JSON.stringify(meta)}`;
  return line;
});

export const logger = winston.createLogger({
  level: config.LOG.LEVEL,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  defaultMeta: { service: config.SERVICE_NAME, env: config.NODE_ENV },
  transports: [
    new winston.transports.Console({
      format:
        config.NODE_ENV === 'development'
          ? combine(colorize(), timestamp(), devFormat)
          : combine(timestamp(), json()),
    }),
  ],
  silent: config.NODE_ENV === 'test',
});

export default logger;
