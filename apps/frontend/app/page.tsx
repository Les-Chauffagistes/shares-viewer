import { LiveArenaCanvas } from "@/components/live-arena/LiveArenaCanvas";
import { TopNav } from "@/components/top-nav";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <TopNav />

      <div className="mx-auto max-w-7xl space-y-10 p-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">Bitcoin Workers Life</h1>
          <p className="text-neutral-400">
            Visualisation en direct des mineurs de la pool chauffagistes-pool.fr
          </p>
        </header>

        <LiveArenaCanvas />

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="max-w-4xl space-y-4">
            <h2 className="text-2xl font-bold">Concept</h2>

            <p className="leading-7 text-neutral-300">
              Bitcoin Workers Life est une visualisation en temps réel des mineurs
              actifs sur la pool{" "}
              <a
                href="https://chauffagistes-pool.fr"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                chauffagistes-pool.fr
              </a>
              . Chaque personnage représente un worker en train de miner, avec
              des données directement issues des shares envoyées au backend.
            </p>

            <p className="leading-7 text-neutral-300">
              L’arène permet de transformer les statistiques de minage en une
              représentation visuelle vivante : taille, vitesse et présence des
              personnages évoluent en fonction des performances, notamment la
              best share du round en cours.
            </p>

            <p className="leading-7 text-neutral-300">
              Le projet est actuellement en version{" "}
              <span className="text-yellow-400 font-medium">pré-alpha</span>.
              Certaines données, comme les niveaux ou la progression des workers,
              peuvent être réinitialisées à tout moment.
            </p>

            <p className="leading-7 text-neutral-300">
              Code source :{" "}
              <a
                href="https://github.com/Les-Chauffagistes/shares-viewer"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                shares-viewer
              </a>{" "}
              Développé par{" "}
              <a
                href="https://github.com/itrider-gh"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                itrider-gh
              </a>
              .
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="max-w-4xl space-y-4">
            <h2 className="text-2xl font-bold">Crédits des sprites</h2>

            <p className="leading-7 text-neutral-300">
              Les sprites utilisés dans cette interface proviennent du projet{" "}
              <a
                href="https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                Universal LPC Spritesheet Character Generator
              </a>
              .
            </p>

            <p className="leading-7 text-neutral-300">
              Les crédits détaillés des auteurs et des licences sont disponibles dans le
              fichier{" "}
              <a
                href="/CREDITS.csv"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:underline"
              >
                CREDITS.csv
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}