import { ArrowRight } from "lucide-react";
import type { VoyageLanguage } from "@/lib/voyageI18n";

interface Props {
  language: VoyageLanguage;
  origin: string;
  destination: string;
  to: string;
}

export default function VoyageTitle({ language, origin, destination, to }: Props) {
  if (language === "RO") {
    return (
      <div className="apolodor-heading">
        <div>
          <h1>Apolodor pe Atlantic</h1>
          <p>{origin} <span aria-label={to}>→</span> {destination}</p>
        </div>
        <img src="/apolodor-ketch.svg" width="196" height="120"
          alt="Apolodor pe Soulmate, un Motiva 46 cu două catarge" />
      </div>
    );
  }
  return (
    <h1 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
      {origin}
      <ArrowRight className="h-6 w-6 text-primary sm:h-7 sm:w-7" aria-label={to} />
      {destination}
    </h1>
  );
}
