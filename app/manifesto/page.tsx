import { auth } from "@/auth";
import { MarketingNav } from "@/components/nav";

export const metadata = { title: "Manifesto" };

export default async function ManifestoPage() {
  const session = await auth();
  return (
    <>
      <MarketingNav session={session?.user} />
      <main className="pt-40 pb-24">
        <article className="container-x max-w-3xl prose prose-invert">
          <span className="inline-flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-ink-2">
            <span className="size-1.5 rounded-full bg-brand-blue shadow-[0_0_12px_#5B6CFF]" />
            Manifesto · v1 · Paris · Mai 2026
          </span>
          <h1 className="text-[clamp(48px,8vw,96px)] leading-[.96] tracking-[-0.04em] font-medium mt-8 mb-12">
            Le travail tel qu'on l'a connu{" "}
            <span className="font-serif italic">est terminé.</span>
          </h1>

          <p className="text-2xl text-ink leading-snug mb-6">
            Pas dans dix ans. Pas en 2030. <strong>Maintenant.</strong>
          </p>

          <Section title="I. Le constat">
            Pendant un siècle, l'entreprise a été une cathédrale d'humains qui
            s'envoient des emails. Des humains qui copient des chiffres d'un
            onglet à l'autre. Nous avons confondu l'effort avec le résultat.
          </Section>

          <Section title="II. La rupture">
            En 2025, les modèles de langage ont franchi un seuil économique :
            faire-faire à une IA est devenu durablement moins cher, plus rapide,
            et — sur les bonnes tâches — plus rigoureux. Mais une IA brute n'est
            pas un employé. Pour devenir un employé, il faut une plate-forme.
            <strong> Cette couche, c'est Axion.</strong>
          </Section>

          <Section title="III. La promesse">
            <ul className="list-none space-y-4 mt-6">
              {[
                ["Vous restez aux commandes.", "Permissions, budgets, approbations à seuil."],
                ["Vous voyez tout.", "Audit immuable SHA-256, replay 90 jours."],
                ["Vos données restent vos données.", "Jamais utilisées pour entraîner."],
                ["Vous payez le résultat.", "Pas le token. Pas l'heure."],
                ["Vous repartez quand vous voulez.", "Standards ouverts. Export complet."],
              ].map(([h, p]) => (
                <li key={h} className="flex gap-4">
                  <span className="text-brand-blue text-xl">›</span>
                  <span>
                    <strong className="text-ink">{h}</strong>{" "}
                    <span className="text-ink-2">{p}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="IV. Notre mission">
            <blockquote className="font-serif italic text-3xl leading-snug border-l-2 border-brand-blue pl-6 my-8 text-ink">
              Notre mission n'est pas de rendre les entreprises sans humains.
              C'est de rendre les humains irremplaçables.
            </blockquote>
          </Section>

          <p className="text-xl text-ink-2 mt-12">
            Si tu lis ce manifesto et que ça résonne — viens. On a beaucoup à
            construire. On a très peu de temps.
          </p>
          <p className="text-ink-2 mt-2">
            — <span className="font-serif">L'équipe Axion</span>
          </p>
        </article>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-3xl tracking-tight font-medium mb-4">{title}</h2>
      <div className="text-ink-2 text-lg leading-relaxed">{children}</div>
    </section>
  );
}
