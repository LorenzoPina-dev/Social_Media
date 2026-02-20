import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3009),
  SERVICE_NAME: Joi.string().default('moderation-service'),

  DATABASE_URL: Joi.string().uri().required(),
  TEST_DATABASE_URL: Joi.string().uri().optional(),

  REDIS_URL: Joi.string().uri().required(),

  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_GROUP_ID: Joi.string().default('moderation-service-group'),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),

  PERSPECTIVE_API_KEY: Joi.string().optional(),
  PERSPECTIVE_API_URL: Joi.string()
    .uri()
    .default('https://commentanalyzer.googleapis.com/v1alpha1'),

  AWS_REGION: Joi.string().default('eu-west-1'),
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),

  POST_SERVICE_URL: Joi.string().uri().default('http://post-service:3003'),
  MEDIA_SERVICE_URL: Joi.string().uri().default('http://media-service:3004'),

  ML_AUTO_REJECT_THRESHOLD: Joi.number().min(0).max(1).default(0.8),
  ML_AUTO_APPROVE_THRESHOLD: Joi.number().min(0).max(1).default(0.2),

  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
});

const { error, value } = schema.validate(process.env, { allowUnknown: true });

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: value.NODE_ENV as string,
  port: value.PORT as number,
  serviceName: value.SERVICE_NAME as string,
  isProduction: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',

  database: {
    url:
      value.NODE_ENV === 'test'
        ? (value.TEST_DATABASE_URL ?? value.DATABASE_URL)
        : (value.DATABASE_URL as string),
  },

  redis: {
    url: value.REDIS_URL as string,
  },

  kafka: {
    brokers: (value.KAFKA_BROKERS as string).split(','),
    groupId: value.KAFKA_GROUP_ID as string,
  },

  jwt: {
    accessSecret: value.JWT_ACCESS_SECRET as string,
  },

  perspective: {
    apiKey: value.PERSPECTIVE_API_KEY as string | undefined,
    apiUrl: value.PERSPECTIVE_API_URL as string,
  },

  aws: {
    region: value.AWS_REGION as string,
    accessKeyId: value.AWS_ACCESS_KEY_ID as string | undefined,
    secretAccessKey: value.AWS_SECRET_ACCESS_KEY as string | undefined,
  },

  services: {
    postServiceUrl: value.POST_SERVICE_URL as string,
    mediaServiceUrl: value.MEDIA_SERVICE_URL as string,
  },

  ml: {
    autoRejectThreshold: value.ML_AUTO_REJECT_THRESHOLD as number,
    autoApproveThreshold: value.ML_AUTO_APPROVE_THRESHOLD as number,
  },

  logLevel: value.LOG_LEVEL as string,
} as const;
