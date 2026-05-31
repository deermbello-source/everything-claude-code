// Service interface — external capability contract.
// Services are capabilities organs can call.
// The system never hardcodes a list of services.

export interface Service {
  name:                string;
  description:         string;
  requires_human_auth: boolean;
  available: ()                              => Promise<boolean>;
  call:      (action: string, params: unknown) => Promise<unknown>;
}

export interface ServiceRegistry {
  register:   (service: Service) => void;
  unregister: (name: string) => void;
  get:        (name: string) => Service | undefined;
  list:       () => Service[];
}

export function makeServiceRegistry(): ServiceRegistry {
  const services = new Map<string, Service>();
  return {
    register:   (s) => { services.set(s.name, s); },
    unregister: (name) => { services.delete(name); },
    get:        (name) => services.get(name),
    list:       () => Array.from(services.values()),
  };
}
