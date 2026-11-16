import { useEffect } from "react";

/**
 * For the crew log and the admin page: keep them out of search results, and hide
 * the site's chat bubble, which would otherwise sit on top of the form on a phone.
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

    const chat = document.querySelector<HTMLElement>("[data-site-chat]");
    const previousDisplay = chat?.style.display ?? "";
    if (chat) {
      chat.style.display = "none";
    }

    return () => {
      if (created) {
        robots?.remove();
      } else if (robots) {
        robots.content = previousRobots;
      }
      if (chat) {
        chat.style.display = previousDisplay;
      }
    };
  }, []);
};
