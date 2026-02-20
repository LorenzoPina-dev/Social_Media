/**
 * Express Type Extensions
 * Augments Express Request with custom user property.
 *
 * IMPORTANTE: questo file non viene mai importato esplicitamente da nessun modulo.
 * ts-node lo carica perché è elencato in "files" dentro tsconfig.json
 * (con la flag "ts-node": { "files": true }).
 * Senza quella configurazione ts-node ignora include/files e il tipo non esiste.
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        verified: boolean;
        mfa_enabled: boolean;
      };
    }
  }
}

// export {} rende questo file un modulo ES, necessario perché
// declare global funzioni correttamente fuori da un contesto ambient.
export {};
