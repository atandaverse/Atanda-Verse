create table if not exists public.faq (
  id text primary key,
  question text not null,
  answer text not null,
  category text not null default 'sessions'
    check (category in ('sessions', 'pricing', 'logistics', 'language')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faq enable row level security;

drop policy if exists "public_read_faq" on public.faq;
drop policy if exists "public_write_faq" on public.faq;

create policy "public_read_faq"
on public.faq for select
to anon, authenticated
using (true);

-- Workspace currently authenticates with the project anon key.
create policy "public_write_faq"
on public.faq for all
to anon, authenticated
using (true)
with check (true);

insert into public.faq (id, question, answer, category, sort_order) values
  ('faq-d1', 'What exactly is a clarity session?', 'A clarity session is a guided conversation designed to cut through mental fog and help you gain perspective on your life, goals, and challenges. It is coaching-based and focused on helping you identify what is blocking you and build a concrete action plan.', 'sessions', 0),
  ('faq-d2', 'Is this coaching, therapy, or counselling?', 'Clarity sessions are coaching-based, not therapy. We focus on your present situation and future goals. For clinical mental health needs, we recommend a licensed therapist.', 'sessions', 1),
  ('faq-d3', 'What should I expect from my first session?', 'Your first session focuses on your situation, identifying mental blocks, and creating a clear vision forward. You will leave with actionable insights and a personalized clarity plan.', 'sessions', 2),
  ('faq-d4', 'How are group sessions different from 1:1?', 'Group sessions have weekly themes and build community accountability. 1:1 sessions are entirely focused on you. Many people start with group and later add 1:1 for deeper work.', 'sessions', 3),
  ('faq-d5', 'Do I need to prepare anything?', 'You will receive a short guide 24 hours before with reflection questions. All you need is a quiet space, stable internet, and an open mind.', 'sessions', 4),
  ('faq-d6', 'Is Atanda Verse free?', 'Your first single clarity session is free during launch. Three-session packages, weekly group access, and monthly intensives are paid guided offers, and payment details are confirmed after registration.', 'pricing', 0),
  ('faq-d7', 'How long is the free single-session offer?', 'The countdown timer on the homepage shows how much time remains for the free single-session launch offer. Paid plans stay available for deeper support.', 'pricing', 1),
  ('faq-d8', 'What are the current paid prices?', 'The default paid pricing is $48 / N60,000 for the three-session package, $36 / N45,000 for weekly group access, and $180 / N225,000 for the monthly intensive. Admin can update these prices when needed.', 'pricing', 2),
  ('faq-d9', 'What if the session does not help me?', 'Your first single session has no payment risk during launch. If it does not add value, tell us honestly. The goal is genuine clarity, not just a completed session.', 'pricing', 3),
  ('faq-d10', 'How do online sessions work?', 'Sessions are held via Zoom or your preferred platform. You will receive a private link and a preparation guide before the session.', 'logistics', 0),
  ('faq-d11', 'What if I miss a scheduled session?', 'Give us 24 hours notice and we will reschedule at no cost where possible.', 'logistics', 1),
  ('faq-d12', 'How quickly can I get a session?', 'We respond within 24 hours of registration. Most people can get their first session within a few days.', 'logistics', 2),
  ('faq-d13', 'Is my conversation confidential?', 'Absolutely. Everything shared stays between you and your facilitator unless you explicitly agree otherwise.', 'logistics', 3),
  ('faq-d14', 'Can I do sessions in Yoruba, Igbo, or Pidgin?', 'Yes. Sessions can be in English, Nigerian Pidgin, Yoruba, or Igbo, depending on what helps you express yourself best.', 'language', 0),
  ('faq-d15', 'Is this relevant to Nigerians specifically?', 'Atanda Verse was built with the Nigerian context in mind, including family expectations, career uncertainty, and economic pressure.', 'language', 1),
  ('faq-d16', 'Can I join from outside Nigeria?', 'Yes. Sessions are virtual and open to people in the diaspora too.', 'language', 2)
on conflict (id) do nothing;
