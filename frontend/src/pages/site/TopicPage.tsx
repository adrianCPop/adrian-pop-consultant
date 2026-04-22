import { Navigate, useLocation } from "react-router-dom";
import TopicPageTemplate from "@/components/site/TopicPageTemplate";
import { topicPages } from "@/content/siteData";

const TopicPage = () => {
  const { pathname } = useLocation();
  const page = topicPages.find((item) => item.route === pathname);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  return <TopicPageTemplate data={page} />;
};

export default TopicPage;
