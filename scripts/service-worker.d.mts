interface CacheLike {
  match(request: string): Promise<Response | undefined>;
}

export function networkFirstNavigation(
  request: Request,
  cache: CacheLike,
  fetchRequest: (request: Request) => Promise<Response>,
): Promise<Response>;

export function createServiceWorker(
  cacheVersion: string,
  precacheUrls: string[],
): string;
