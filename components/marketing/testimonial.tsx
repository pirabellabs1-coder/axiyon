export function Testimonial() {
  return (
    <section className="py-32 bg-bg-2 border-y border-line relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(800px 400px at 50% 0%, rgba(91,108,255,.10), transparent 70%)",
        }}
      />
      <div className="container-x max-w-4xl text-center relative">
        <blockquote className="font-serif italic text-[clamp(28px,4vw,44px)] leading-tight tracking-tight mb-10 text-ink">
          "On a remplacé 4 cabinets et 7 freelances par 9 agents Axion. Notre
          équipe humaine est passée de 28 à 22 personnes — et notre ARR a doublé
          en huit mois. Axion n'est pas un outil. C'est une nouvelle catégorie d'employé."
        </blockquote>
        <div className="flex gap-3.5 items-center justify-center">
          <div className="size-12 rounded-full bg-grad text-white font-semibold text-lg flex items-center justify-center">
            CL
          </div>
          <div className="text-left">
            <div className="text-base font-medium">Claire Laporte</div>
            <div className="text-sm text-ink-2">CEO · Helia (Series B, Paris)</div>
          </div>
        </div>
      </div>
    </section>
  );
}
