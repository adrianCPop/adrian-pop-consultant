import { useEffect } from "react";

/**
 * Hides the consulting site's chat bubble for as long as a voyage page is shown.
 * It belongs to the consulting site, not to the voyage; and on a phone it sits in
 * the corner on top of the page's own controls, where a thumb opens it by accident.
 */
export const useWithoutSiteChat = () => {
  useEffect(() => {
    const chat = document.querySelector<HTMLElement>("[data-site-chat]");
    const previousDisplay = chat?.style.display ?? "";
    if (chat) {
      chat.style.display = "none";
    }

    return () => {
      if (chat) {
        chat.style.display = previousDisplay;
      }
    };
  }, []);
};

/**
 * For the crew log and the admin page: keep them out of search results, and
 * without the site's chat bubble.
 */
export const useCrewOnlyPage = () => {
  useWithoutSiteChat();

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
