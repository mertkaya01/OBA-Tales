/**
 * Bulunamadı ve beklenmeyen hata sayfaları.
 */
import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { Logo } from "../components/ui/Logo";
import { isStaleBuildError } from "../lib/staleBuild";

function LostTrail({ title, message, detail }: { title: string; message: string; detail?: string }) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <Logo size={64} animated={false} className="opacity-70 grayscale-[40%]" />
      <h1 className="text-3xl text-gunozu-300">{title}</h1>
      <p className="text-buz-200">{message}</p>
      <Link to="/" className="rounded-lg bg-gunozu-400 px-4 py-2 font-display text-gece-950 hover:bg-gunozu-300">
        Akınburnu'na dön
      </Link>
      {detail && (
        <details className="mt-4 w-full text-left text-sm text-buz-300">
          <summary>Teknik ayrıntı</summary>
          <pre className="mt-2 whitespace-pre-wrap">{detail}</pre>
        </details>
      )}
    </section>
  );
}

export default function NotFoundPage() {
  return (
    <>
      <title>Patika bulunamadı · OBA-Tales</title>
      <LostTrail title="Bu patika sise karıştı" message="Aradığın yer haritada yok. Dede Toygar bile bu yolu hatırlamıyor!" />
    </>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  // Site yeniden yayınlanmış, bu sekme eski sürümde kalmış (kendiliğinden yenileme az önce denendiyse buraya düşer).
  if (isStaleBuildError(error)) {
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <Logo size={64} animated={false} />
        <h1 className="text-3xl text-gunozu-300">Oba yenilendi</h1>
        <p className="text-buz-200">Sen yokken siteye yenilikler geldi. Sayfayı yenileyince en son hâli açılır.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-gunozu-400 px-4 py-2 font-display text-gece-950 hover:bg-gunozu-300"
        >
          Sayfayı yenile
        </button>
      </section>
    );
  }
  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : String(error);
  return (
    <LostTrail
      title="Bir fırtına koptu"
      message="Bir şeyler ters gitti. Sayfayı yenilemeyi ya da limana dönmeyi dene."
      detail={detail}
    />
  );
}
