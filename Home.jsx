import React from "react";

const topLinks = [
  { label: "Brand", href: "#brand" },
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Verse", href: "https://verse.atanda.site" },
  { label: "Vault", href: "https://vault.atanda.site" },
];

const pathCards = [
  {
    title: "Atanda Verse",
    label: "Public Expression",
    description:
      "Editorial writing, reflection, and clarity work for identity, direction, relationships, and modern life.",
    href: "https://verse.atanda.site",
    cta: "Enter Verse",
    light: true,
  },
  {
    title: "Atanda Vault",
    label: "Private Expression",
    description:
      "A private space for words, messages, and files that should be preserved carefully and delivered on your terms.",
    href: "https://vault.atanda.site",
    cta: "Enter Vault",
    light: false,
  },
];

const writingCards = [
  {
    category: "Clarity",
    title: "The discipline of clear thought in a loud world",
    excerpt:
      "Not every decision needs more noise. Some need better framing, less pressure, and a cleaner atmosphere for thinking.",
  },
  {
    category: "Identity",
    title: "What you preserve becomes part of who you are",
    excerpt:
      "A reflection on memory, restraint, and why intentional preservation is also a form of self-definition.",
  },
  {
    category: "Digital Life",
    title: "Using the internet without losing your interior life",
    excerpt:
      "A practical way to keep technology useful without letting it become the loudest force in your thinking.",
  },
];

function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}

function Eyebrow({ children, light = false }) {
  return (
    <p
      className={`text-[11px] font-medium uppercase tracking-[0.36em] ${
        light ? "text-white/55" : "text-[#8b7a5d]"
      }`}
    >
      {children}
    </p>
  );
}

function ButtonLink({ href, children, variant = "primary" }) {
  const styles =
    variant === "primary"
      ? "border border-[#efc865]/35 bg-[linear-gradient(135deg,#f8dc7a_0%,#d79d28_55%,#8e5c0d_100%)] text-[#120d08] hover:-translate-y-0.5 hover:brightness-110"
      : variant === "ghost"
        ? "border border-white/10 bg-white/[0.04] text-white hover:-translate-y-0.5 hover:bg-white/[0.08]"
        : variant === "dark-outline"
          ? "border border-[#2b2115]/18 bg-[rgba(43,33,21,0.04)] text-[#1b140d] hover:-translate-y-0.5 hover:border-[#2b2115]/42"
      : "border border-[#c18f24]/22 bg-[rgba(193,143,36,0.06)] text-[#f1d48a] hover:-translate-y-0.5 hover:border-[#c18f24]/45";

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition duration-300 ${styles}`}
    >
      {children}
    </a>
  );
}

function SectionHeading({ eyebrow, title, body, light = false, bodyClassName = "" }) {
  return (
    <div className="max-w-3xl">
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2
        className={`mt-4 font-['Fraunces'] text-4xl leading-[1.02] tracking-[-0.035em] sm:text-5xl ${
          light ? "text-[#f8f1df]" : "text-[#17120d]"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-6 max-w-2xl text-base leading-8 ${
          light ? "text-white/68" : "text-[#5c5042]"
        } ${bodyClassName}`}
      >
        {body}
      </p>
    </div>
  );
}

function PanelOrb({ className = "" }) {
  return (
    <div
      className={`pointer-events-none absolute rounded-full border border-[#f0c35a]/15 bg-[radial-gradient(circle_at_32%_28%,#fff3b0_0%,#f2c447_18%,#9e690f_42%,rgba(10,8,6,0.96)_72%)] shadow-[0_0_70px_rgba(215,162,46,0.22)] ${className}`}
    />
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#080604]/84 backdrop-blur-xl">
      <Container className="flex min-h-[4.9rem] items-center justify-between gap-6">
        <a href="#brand" className="flex items-center gap-3 text-[#f6eedf]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4a437]/28 bg-white/[0.03] font-['Fraunces'] text-base">
            A
          </span>
          <span className="font-['Fraunces'] text-2xl tracking-tight">Atanda</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {topLinks.map((item) => (
            <a key={item.label} href={item.href} className="text-sm text-white/58 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <ButtonLink href="https://vault.atanda.site" variant="ghost">
            Explore Vault
          </ButtonLink>
        </div>
      </Container>

      <Container className="pb-4 md:hidden">
        <div className="overflow-hidden rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.65)]">
          <div className="mb-3 flex items-center justify-between px-2">
            <Eyebrow light>Navigate</Eyebrow>
            <span className="text-[10px] uppercase tracking-[0.28em] text-white/40">Atanda</span>
          </div>
          <div className="grid gap-2">
            {topLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-[1rem] border border-white/6 bg-white/[0.03] px-4 py-3 text-sm text-white/78 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span>{item.label}</span>
                <span className="text-white/30">+</span>
              </a>
            ))}
          </div>
        </div>
      </Container>
    </header>
  );
}

function HeroMosaic() {
  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,#17120d_0%,#0c0907_100%)] p-6 sm:min-h-[20rem] sm:p-7">
        <PanelOrb className="right-[-2.5rem] top-[-2.5rem] h-44 w-44 sm:h-56 sm:w-56" />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <Eyebrow light>Atanda</Eyebrow>
            <h3 className="mt-4 max-w-md font-['Fraunces'] text-3xl leading-tight text-[#f8f0e1] sm:text-[2.15rem]">
              The parent brand for what should be expressed and what should be protected.
            </h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/68">
              Atanda is the source layer. Verse and Vault are two distinct experiences held
              inside the same emotional and visual system.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-[#cf9b2d]/18 bg-[linear-gradient(180deg,rgba(228,183,61,0.16),rgba(255,255,255,0.03))] p-5">
              <Eyebrow light>Verse</Eyebrow>
              <p className="mt-3 font-['Fraunces'] text-2xl leading-tight text-[#f8f0e1]">
                Public clarity
              </p>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Editorial writing, perspective, and open expression.
              </p>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
              <Eyebrow light>Vault</Eyebrow>
              <p className="mt-3 font-['Fraunces'] text-2xl leading-tight text-[#f8f0e1]">
                Private preservation
              </p>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Timing, privacy, and deliberate delivery on your terms.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="brand" className="relative overflow-hidden border-b border-white/8 bg-[#080604] pb-24 pt-14 sm:pt-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(230,186,70,0.16),transparent_22%),radial-gradient(circle_at_82%_14%,rgba(135,92,15,0.18),transparent_20%),linear-gradient(180deg,#080604_0%,#120d09_48%,#17110c_100%)]" />
      <div className="pointer-events-none absolute right-[4%] top-6 hidden font-['Fraunces'] text-[10rem] uppercase tracking-[0.24em] text-white/[0.04] xl:block">
        Atanda
      </div>
      <PanelOrb className="left-[-5rem] top-[8rem] h-48 w-48 md:h-64 md:w-64" />
      <Container className="relative">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.9fr)] lg:items-center">
          <div className="pt-6 lg:pt-10">
            <Eyebrow light>Parent Brand</Eyebrow>
            <h1 className="mt-6 max-w-3xl font-['Fraunces'] text-6xl leading-[0.9] tracking-[-0.06em] text-[#f8f0e1] sm:text-7xl lg:text-[6.6rem]">
              One world for public clarity and private preservation.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-white/68 sm:text-xl">
              Atanda is the parent brand behind Atanda Verse and Atanda Vault. One side lives in
              public through writing and perspective. The other protects what should remain private
              until the right time.
            </p>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
              <ButtonLink href="https://verse.atanda.site">Enter Atanda Verse</ButtonLink>
              <ButtonLink href="https://vault.atanda.site" variant="ghost">
                Enter Atanda Vault
              </ButtonLink>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-6 text-sm text-white/62">
              <span className="border-l border-[#d2a032]/40 pl-4">Atanda sets the atmosphere.</span>
              <span className="border-l border-[#d2a032]/40 pl-4">Verse opens outward.</span>
              <span className="border-l border-[#d2a032]/40 pl-4">Vault turns inward.</span>
            </div>
          </div>

          <HeroMosaic />
        </div>
      </Container>
    </section>
  );
}

function Philosophy() {
  return (
    <section className="bg-[linear-gradient(180deg,#d3a74a_0%,#b57f1d_100%)] py-24">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.7fr)]">
          <SectionHeading
            eyebrow="Philosophy"
            title="Atanda exists to give meaningful things a better atmosphere."
            body="The digital world flattens everything into urgency, performance, and constant display. Atanda moves in the opposite direction. It creates a more deliberate atmosphere where public ideas can be shared with clarity and private things can remain protected."
            bodyClassName="!text-[#2b2115]"
          />

                <div className="rounded-[1.9rem] border border-[#6e4a0b]/18 bg-[linear-gradient(180deg,rgba(255,232,173,0.78),rgba(206,149,39,0.68))] p-7 shadow-[0_28px_90px_-70px_rgba(18,14,10,0.34)]">
            <Eyebrow>Design Principle</Eyebrow>
            <p className="mt-4 font-['Fraunces'] text-2xl leading-tight text-[#17120d]">
              The landing page should feel like the parent system, not a Verse wrapper.
            </p>
            <p className="mt-4 text-sm leading-7 text-[#5c5042]">
              The UX job is simple: establish trust in Atanda, then make the two paths obvious
              and distinct without forcing the user to decode the brand.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Ecosystem() {
  return (
    <section id="ecosystem" className="bg-[#110c08] py-24">
      <Container>
        <SectionHeading
          eyebrow="Ecosystem"
          title="Two paths inside one brand world."
          body="Verse and Vault should feel clearly different in purpose while remaining unmistakably connected in mood, taste, and seriousness."
          light
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {pathCards.map((card) => (
            <article
              key={card.title}
              className={`relative overflow-hidden rounded-[2.2rem] border p-8 sm:p-10 ${
                card.light
                        ? "border-[#6f4d11]/18 bg-[linear-gradient(180deg,#ffeaab_0%,#d49a29_100%)] text-[#17120d]"
                        : "border-white/10 bg-[linear-gradient(180deg,#0f0c09_0%,#080604_100%)] text-white"
                    }`}
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-28 ${
                        card.light
                          ? "bg-gradient-to-b from-[#fff4bf]/70 to-transparent"
                          : "bg-gradient-to-b from-[#d2a032]/10 to-transparent"
                      }`}
                    />
              <div className="relative">
                <Eyebrow light={!card.light}>{card.label}</Eyebrow>
                <h3 className="mt-5 font-['Fraunces'] text-4xl leading-none">{card.title}</h3>
                <p className={`mt-6 max-w-xl text-base leading-8 ${card.light ? "text-[#5c5042]" : "text-white/70"}`}>
                  {card.description}
                </p>
                <div className="mt-8">
                  <ButtonLink href={card.href} variant={card.light ? "dark-outline" : "ghost"}>
                    {card.cta}
                  </ButtonLink>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Writings() {
  return (
    <section className="bg-[linear-gradient(180deg,#c99632_0%,#a36f16_100%)] py-24">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="From Atanda Verse"
            title="A glimpse of the public expression."
            body="Verse is where Atanda becomes visible in public through writing, reflection, and a more deliberate editorial voice."
            bodyClassName="!text-[#2b2115]"
          />
          <p className="max-w-sm text-sm uppercase tracking-[0.3em] text-[#8b7a5d]">
            verse.atanda.site
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {writingCards.map((entry, index) => (
            <article
              key={entry.title}
                    className={`rounded-[1.8rem] border border-[#6f4d11]/18 p-7 ${
                      index === 0
                        ? "bg-[#17120d] text-white md:col-span-2 xl:col-span-1"
                        : "bg-[linear-gradient(180deg,rgba(255,231,164,0.84),rgba(206,149,39,0.76))] text-[#17120d]"
                    }`}
                  >
              <div className={`flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.28em] ${index === 0 ? "text-white/52" : "text-[#8b7a5d]"}`}>
                <span>{entry.category}</span>
                <span>{`0${index + 1}`}</span>
              </div>
              <div className={`mt-4 h-px w-10 ${index === 0 ? "bg-[#d6a637]/60" : "bg-[#c18f24]/70"}`} />
              <h3 className={`mt-5 font-['Fraunces'] text-3xl leading-tight ${index === 0 ? "text-[#f8f0e1]" : "text-[#17120d]"}`}>
                {entry.title}
              </h3>
              <p className={`mt-4 text-sm leading-7 ${index === 0 ? "text-white/68" : "text-[#5c5042]"}`}>
                {entry.excerpt}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <ButtonLink href="https://verse.atanda.site" variant="dark-outline">
            Read Atanda Verse
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

function Closing() {
  return (
    <section className="bg-[#080604] py-24">
      <Container>
        <div className="rounded-[2.4rem] border border-white/8 bg-[linear-gradient(180deg,#14100b_0%,#080604_100%)] px-8 py-12 shadow-[0_36px_140px_-85px_rgba(0,0,0,0.82)] sm:px-12">
          <Eyebrow light>Closing Statement</Eyebrow>
          <h2 className="mt-6 max-w-4xl font-['Fraunces'] text-4xl leading-tight text-[#f8f0e1] sm:text-5xl">
            Atanda is the parent brand for what should be expressed with clarity and preserved with care.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/66">
            The UX should make the next step easy: public expression through Verse, private
            preservation through Vault.
          </p>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
            <ButtonLink href="https://verse.atanda.site">Enter Atanda Verse</ButtonLink>
            <ButtonLink href="https://vault.atanda.site" variant="ghost">
              Enter Atanda Vault
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/8 bg-[#080604] py-8">
      <Container className="flex flex-col gap-4 text-sm text-white/56 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-['Fraunces'] text-2xl text-[#f8f0e1]">Atanda</p>
        <nav className="flex flex-wrap gap-6">
          <a href="https://verse.atanda.site" className="hover:text-white">
            Verse
          </a>
          <a href="https://vault.atanda.site" className="hover:text-white">
            Vault
          </a>
          <a href="#ecosystem" className="hover:text-white">
            Ecosystem
          </a>
        </nav>
        <p>2026 Atanda. All rights reserved.</p>
      </Container>
    </footer>
  );
}

export default function Home() {
  return (
    <main
      className="min-h-screen bg-[#080604] text-[#17120d] antialiased"
      style={{ fontFamily: '"Space Grotesk","Manrope",system-ui,sans-serif' }}
    >
      <Navbar />
      <Hero />
      <Philosophy />
      <Ecosystem />
      <Writings />
      <Closing />
      <Footer />
    </main>
  );
}
