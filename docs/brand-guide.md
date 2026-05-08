# Axion — Brand Guide

> v1.4 · Mai 2026 · Owner : Théo Martelli (CPO) + Hue (Brand agent)
> Tout asset marque doit respecter ce document. Si un cas n'est pas couvert, demandez à brand@axion.ai.

---

## 1. Mission & promise

**Mission**
> Donner à chaque entreprise une équipe d'employés IA qu'elle peut vraiment piloter, mesurer, et faire confiance.

**Promise (one-liner public)**
> *L'OS de l'entreprise autonome.*

**Promise (one-liner sales/B2B)**
> *Recrutez vos employés IA en 60 secondes.*

**Promise (manifesto)**
> *Notre mission n'est pas de rendre les entreprises sans humains. C'est de rendre les humains irremplaçables.*

---

## 2. Voix & ton

### 2.1 Pillars

1. **Direct.** Pas de buzzword. Pas de "transformation digitale". Si on peut le dire en moins de mots, on le fait.
2. **Confiant, jamais arrogant.** On affirme, on prouve. On ne se compare pas négativement aux concurrents.
3. **Précis.** Chiffres datés, citations attribuées, métriques signées. Pas de "many", "lots", "significantly".
4. **Humain.** Même quand on parle d'IA. On écrit comme un humain qui parle à un humain. Pas comme un agent qui répond à un prompt.
5. **Sérieux sur les sujets graves, léger sur le reste.** Sécurité, conformité, éthique : ton sobre. Onboarding, marketing, communauté : ton chaleureux et joueur.

### 2.2 Phrases qu'on dit

- "Recrutez votre premier agent."
- "Le résultat, pas le token."
- "Vous gardez le dernier mot."
- "Conçu pour passer un audit Big 4."
- "L'humain reste irremplaçable."

### 2.3 Phrases qu'on évite

- ❌ "Disruptez votre business" → "Transformez vos workflows"
- ❌ "Powered by AI" → "Avec votre équipe d'agents"
- ❌ "Cutting-edge" → "Construit pour 2026"
- ❌ "Bot" → "Agent" (bots = chatbots = mauvaise UX 2018)
- ❌ "Autonomous AI" → "Autonomous enterprise" (le sujet, c'est l'entreprise, pas l'IA)
- ❌ "Replace your team" → "Augmentez votre équipe"

### 2.4 Style d'écriture (de l'index à un email)

- **Phrases courtes.** Sub-15 mots quand c'est possible.
- **Verbes actifs.** "Iris a booké 6 démos" pas "6 démos ont été bookées par Iris".
- **Je/Tu/Vous.** Pas de "on" évasif. Pas de "we believe" généralement, on dit "we know" or "we measure".
- **Exemples concrets.** Toujours préférer un cas client à une abstraction.
- **Mix italique-serif (Instrument Serif italic) sur les mots-pivot.** Crée un rythme typographique éditorial.

---

## 3. Logo

### 3.1 Le mark

```
[carré gradient bleu→cyan, coin arrondi 22%, avec un carré central noir, et un point central gradient]
```

- Construction : carré 28×28px
- Coin radius : 25% (7px sur 28)
- Background : `linear-gradient(135deg, #5B6CFF 0%, #22D3EE 100%)`
- Inset square : 18%, color = bg page (#050507 ou blanc selon thème)
- Center dot : 32% from center, gradient identique au mark

### 3.2 Le wordmark

- Police : **Inter Display** (à défaut : Inter)
- Weight : 600
- Letter-spacing : -0.02em
- Capitalisation : **Axion** (jamais "AXION", jamais "axion")
- Wordmark seul autorisé sur fond noir uniquement, à partir de 14px de hauteur

### 3.3 Lock-up

- Mark + wordmark = unit standard
- Espace de garde minimum autour : hauteur du mark / 2 (= 14px sur mark 28px)
- Ratio mark/wordmark : 1:2.4 environ

### 3.4 Don'ts

- ❌ Ne pas étirer / déformer
- ❌ Ne pas changer les couleurs du gradient
- ❌ Ne pas ajouter d'ombres, de glows, d'effets non spécifiés
- ❌ Ne pas mettre le wordmark sans le mark sur fond clair
- ❌ Ne pas utiliser le mark seul à moins de 16px de côté

---

## 4. Couleurs

### 4.1 Primary palette

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#050507` | Background principal (dark mode) |
| `--bg-2` | `#0B0B11` | Cards, panels, surfaces 1 |
| `--bg-3` | `#13131C` | Surfaces 2, hover states |
| `--bg-4` | `#1A1A24` | Surfaces 3, focused states |
| `--line` | `#1F1F2E` | Borders standard |
| `--line-2` | `#2A2A3A` | Borders hover |
| `--ink` | `#F5F5FA` | Texte primaire |
| `--ink-2` | `#9A9AAE` | Texte secondaire |
| `--ink-3` | `#5A5A6E` | Texte tertiaire / muted |

### 4.2 Brand & functional

| Token | Hex | Usage |
|---|---|---|
| `--blue` | `#5B6CFF` | Primary accent |
| `--blue-2` | `#7C8AFF` | Hover, lighter accent |
| `--cyan` | `#22D3EE` | Secondary accent (pair with blue) |
| `--magenta` | `#FF3D8E` | Tertiary accent (sparing use) |
| `--gold` | `#E8B86D` | Premium / Enterprise tier |
| `--green` | `#34D399` | Success, status OK |
| `--red` | `#F87171` | Error, danger |
| `--yellow` | `#FCD34D` | Warning |

### 4.3 Gradients signature

```css
/* Gradient principal — utilisé pour le mark, les CTAs glow, les accents-clé */
--grad: linear-gradient(135deg, #5B6CFF 0%, #22D3EE 100%);

/* Gradient secondaire — utilisé pour les avatars Atlas (CFO) et les éléments warm */
--grad-2: linear-gradient(135deg, #FF3D8E 0%, #5B6CFF 100%);

/* Gradient gold — pour Codex (juriste) et tier Enterprise */
--grad-3: linear-gradient(135deg, #E8B86D 0%, #FF3D8E 100%);
```

### 4.4 Light mode (à venir Q3 2026)

- bg : `#FFFFFF` → `#FAFAFA`
- ink : `#0A0A0E` → `#3F3F4E`
- line : `#E5E7EB`
- accents : identiques

---

## 5. Typography

### 5.1 Fontes

- **Body & UI** : `Inter` (300/400/500/600/700)
- **Display & headlines lourdes** : `Inter` 500 (no Display variant pour l'instant)
- **Mots-pivot italique éditoriale** : `Instrument Serif` (italic 400) — utilisé sparingly pour rythme
- **Mono / code / numbers** : `JetBrains Mono` (400/500)

### 5.2 Échelle typo (web)

| Token | Taille | Usage |
|---|---|---|
| `display-xl` | clamp(48px, 8vw, 96px) | Hero h1, manifesto h1 |
| `display-l` | clamp(40px, 6vw, 72px) | CTAs final, section pivots |
| `display-m` | clamp(36px, 5vw, 56px) | Section h2 |
| `display-s` | 32px | h3 |
| `body-l` | 19-20px | Lead, page sub |
| `body-m` | 15-17px | Body text |
| `body-s` | 13-14px | Small, meta |
| `caption` | 11-12px | Labels, mono |
| `micro` | 10px | Badges, tags |

### 5.3 Letter-spacing

- Display : -0.03em à -0.04em (tighter)
- Body : -0.005em (slightly tight)
- Mono / labels uppercase : +0.06em à +0.08em (looser)

### 5.4 Line-height

- Display : 0.96 - 1.05
- Body : 1.5 - 1.65
- UI : 1.4 - 1.5

---

## 6. Iconographie & motifs

### 6.1 Icônes UI

- Lucide-icons style (1.5px stroke, rounded corners)
- 16/20/24px standards
- Outlined par défaut, filled pour états actifs
- Couleur : `--ink-2` par défaut, `--ink` au hover, `--blue` en actif

### 6.2 Avatars d'agents

Chaque agent a un emoji-icon dédié + un gradient signature. Voir [agents.html](../agents.html).

| Famille | Couleur principale | Usage |
|---|---|---|
| Sales / SDR | `--blue` → `--cyan` | Iris, Reva, Cyrus |
| Finance | `--magenta` → `--blue` | Atlas, Sigma |
| Support | `--green` accent | Sage, Echo |
| Legal | `--gold` → `--magenta` | Codex, Charter |
| Engineering | `--cyan` accent | Forge, Hunter |

### 6.3 Motifs background

- Grain texture subtle (5% noise) sur backgrounds
- Radial gradients accents-couleur très atténués (max 18% opacity)
- Grid 60×60px en background des hero (mask-radial)

---

## 7. Voice (sound)

### 7.1 Voice clone des agents

Chaque agent peut être customisé avec la voice de l'entreprise. Default voices :
- **Iris** (FR) : Sophie · 30s, ton chaleureux confiant
- **Iris** (EN) : Emma · 28s, calm professional
- **Atlas** : Marcus · 38s, deep authoritative
- **Sage** : Léa · 26s, friendly patient

### 7.2 UI sounds (web app)

- **Notification** : 220Hz sub-glissando, 180ms (zen-tone, jamais alarmant)
- **Action confirmed** : 880Hz tick, 60ms
- **Error** : 440Hz to 220Hz fade, 240ms
- Tous les sons OFF par défaut, opt-in dans settings

---

## 8. Photographie & vidéo

### 8.1 Photos

- **Photos d'équipe** : N&B + accent couleur signature en post (overlay très subtil)
- **Photos de bureau** : couleur naturelle, lumière du jour, jamais staged
- **Stock photos** : autorisées si elles ne ressemblent pas à du stock (chercher Unsplash + créateurs nichés)

### 8.2 Vidéo

- **Format brand films** : 16:9 4K, ratio cinématique 2.39:1 pour les hero
- **Color grade** : ombres bleues, mid-tones neutres, highlights chauds (look "blade runner" tempéré)
- **Music** : ambient electronic, < 90 BPM. Library : Audio Network, Musicbed.
- **Subtitles** : par défaut, FR + EN. Police Inter 16-20px white #FAFAFA outline 1px noir

---

## 9. Don'ts généraux

- ❌ Pas d'images stock "robot" générique. Pas d'images IA générées qui ressemblent à du stock IA.
- ❌ Pas d'écran "futuristic" Hollywood (lignes vertes Matrix, hologrammes).
- ❌ Pas de visages fake (deepfakes, AI-generated portraits) sur du marketing.
- ❌ Pas de violation de marques tierces (clients) sans accord écrit.
- ❌ Pas de claims chiffrés non sourcés. Si on dit "14×", on a un client signed-off derrière.

---

## 10. Templates & assets

Tous les assets brand vivent dans `brand.axion.ai` (interne) :

- Logo pack (.svg, .png, .ai, .figma) — light & dark
- Templates pitch deck (Keynote, PowerPoint, Figma)
- Templates social (Instagram, Twitter, LinkedIn)
- Templates one-pager / case study
- Photos library (équipe, bureau, événements)
- Brand demos animées (Lottie, .mp4)

Pour usage externe (presse, partenaires, clients) : [press kit téléchargeable](../company.html#press)

---

*Brand Guide v1.4 · Mai 2026*
*Questions : brand@axion.ai*
