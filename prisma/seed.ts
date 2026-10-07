// Seeds 4 upcoming Thursdays with the sample menu from design/Breakfast Club.dc.html.
// Safe to run more than once: existing rows are kept, missing ones are added.
// Dev only (docs/open-questions.md #27): the live database gets members from Slack sign-in.
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, Role, RsvpAnswer } from "../src/generated/prisma/client";
import { nyToday, upcomingThursdays } from "../src/lib/thursdays";

if (process.env.ALLOW_SEED !== "true" || process.env.VERCEL_ENV === "production") {
  console.error(
    "Refusing to seed: set ALLOW_SEED=true in your local .env (dev database only). Never set it in production.",
  );
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

// Seed members get fake Slack IDs; real members are created when they sign in with Slack.
const MEMBERS: { name: string; role?: Role }[] = [
  { name: "Chelsea Merrill", role: Role.ORGANIZER },
  { name: "Jordan Reyes" },
  { name: "Jane Doe" },
  { name: "Sam Lee" },
  { name: "Priya Nair" },
  { name: "Marcus Cole" },
  { name: "Alex Kim" },
  { name: "Dana Ortiz" },
  { name: "Corbin" },
  { name: "Fred De Koker" },
  { name: "Joshua Cantor-Stone" },
  { name: "Nicole Roberts" },
];

const MENU = [
  { item: "Waffles", sponsorsNeeded: 1, orderingEnabled: true, sponsor: "Corbin" },
  { item: "Quiche", sponsorsNeeded: 1, orderingEnabled: true, sponsor: "Fred De Koker" },
  {
    item: "Bagels and Lox",
    sponsorsNeeded: 2,
    orderingEnabled: true,
    sponsor: "Joshua Cantor-Stone",
  },
  { item: "McGriddles", sponsorsNeeded: 1, orderingEnabled: false, sponsor: "Nicole Roberts" },
];

const FIRST_WEEK_RSVPS: Record<string, RsvpAnswer> = {
  "Jane Doe": RsvpAnswer.YES,
  "Sam Lee": RsvpAnswer.YES,
  "Priya Nair": RsvpAnswer.YES,
  "Marcus Cole": RsvpAnswer.YES,
  "Alex Kim": RsvpAnswer.YES,
  "Dana Ortiz": RsvpAnswer.NO,
};

const seedSlackId = (name: string) => `SEED_${name.toUpperCase().replace(/[^A-Z]+/g, "_")}`;

async function main() {
  await db.appSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const members = new Map<string, string>();
  for (const m of MEMBERS) {
    const row = await db.member.upsert({
      where: { slackUserId: seedSlackId(m.name) },
      update: {},
      create: { slackUserId: seedSlackId(m.name), name: m.name, role: m.role ?? Role.MEMBER },
    });
    members.set(m.name, row.id);
  }
  const organizerId = members.get("Chelsea Merrill")!;

  const thursdays = upcomingThursdays(MENU.length);
  for (const [i, date] of thursdays.entries()) {
    const week = MENU[i];
    const event = await db.breakfastEvent.upsert({
      where: { date },
      update: {},
      create: { date, sponsorsNeeded: week.sponsorsNeeded, orderingEnabled: week.orderingEnabled },
    });

    const hasMenu = await db.menuItem.count({ where: { eventId: event.id } });
    if (!hasMenu) {
      await db.menuItem.create({
        data: {
          eventId: event.id,
          name: week.item,
          sponsorships: {
            create: {
              createdById: organizerId,
              members: { create: { memberId: members.get(week.sponsor)! } },
            },
          },
        },
      });
    }

    if (i === 0) {
      for (const [name, answer] of Object.entries(FIRST_WEEK_RSVPS)) {
        const memberId = members.get(name)!;
        await db.rsvp.upsert({
          where: { eventId_memberId: { eventId: event.id, memberId } },
          update: {},
          create: { eventId: event.id, memberId, answer },
        });
      }
    }
  }

  // Like the design: the coming Thanksgiving is skipped. Only touches a week that is still a
  // plain scheduled week, so a real organizer change is never overwritten.
  const thanksgiving = nextThanksgiving(nyToday());
  const tg = await db.breakfastEvent.upsert({
    where: { date: thanksgiving },
    update: {},
    create: { date: thanksgiving },
  });
  if (tg.status === "SCHEDULED") {
    await db.breakfastEvent.update({
      where: { id: tg.id },
      data: { status: "SKIPPED", skipReason: "Thanksgiving" },
    });
  }

  console.log(
    `Seeded ${MEMBERS.length} members, ${thursdays.length} Thursdays, and Thanksgiving (${thanksgiving.toISOString().slice(0, 10)}) skipped.`,
  );
}

/** US Thanksgiving (4th Thursday of November) on or after `today`, as a @db.Date value. */
function nextThanksgiving(today: Date): Date {
  for (let year = today.getUTCFullYear(); ; year++) {
    const nov1 = new Date(Date.UTC(year, 10, 1));
    const firstThursday = 1 + ((4 - nov1.getUTCDay() + 7) % 7);
    const date = new Date(Date.UTC(year, 10, firstThursday + 21));
    if (date >= today) return date;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
