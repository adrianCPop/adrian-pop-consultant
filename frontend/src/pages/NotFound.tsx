import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">404</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
        The page you requested does not exist or has been moved during the platform rebuild.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Return to homepage
      </Link>
    </div>
  );
};

export default NotFound;
