const VOYAGE_PAGES = ["/voyage", "/voyage/log", "/voyage/admin"];

/**
 * Whether an address is one of the voyage pages. They stand on their own: the
 * consulting site's top bar and chat bubble are left off them. Only those three
 * pages (the router matches them in any letter case, with or without a closing
 * slash), so a mistyped address under /voyage/ still gets the site's "not found"
 * page whole.
 */
export const isVoyagePath = (pathname: string): boolean =>
  VOYAGE_PAGES.includes(pathname.toLowerCase().replace(/\/+$/, ""));
