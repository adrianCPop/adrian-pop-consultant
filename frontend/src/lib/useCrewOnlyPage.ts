import { useEffect } from "react";

/**
 * For the crew log and the admin page: keep them out of search results for as
 * long as they are shown. (The site's chat bubble is left off every voyage page
 * where it is mounted, in `App.tsx`.)
 */
export const useCrewOnlyPage = () => {
  useEffect(() => {
    // The site already has a robots tag; change it for as long as this page is shown.
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = robots === null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    const previousRobots = robots.content;
    robots.content = "noindex, nofollow";

    return () => {
      if (created) {
        robots?.remove();
      } else if (robots) {
        robots.content = previousRobots;
      }
    };
  }, []);
};
