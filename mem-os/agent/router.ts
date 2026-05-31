// Agent router — selects which organ or service handles a step.
// Separates "what to do" (planner) from "who does it" (router).
// The runtime executes whatever the router selects.

import { Step } from './state';
import { OrganRegistry } from '../interfaces/organ';
import { ServiceRegistry } from '../interfaces/service';

export type RouteResult =
  | { type: 'organ';      name: string }
  | { type: 'service';    name: string }
  | { type: 'unresolved'; name: string };

export function route(
  step:     Step,
  organs:   OrganRegistry,
  services: ServiceRegistry,
): RouteResult {
  const organ = organs.get(step.organ);
  if (organ) return { type: 'organ', name: organ.name };

  const service = services.get(step.organ);
  if (service) return { type: 'service', name: service.name };

  return { type: 'unresolved', name: step.organ };
}
