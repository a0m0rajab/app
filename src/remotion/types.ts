export type ScreenKind = "chart" | "table" | "board";

export type Screen = {
  kind: ScreenKind;
  title: string;
  metrics: { label: string; value: string }[];
  chart: number[];
  rows: { title: string; meta: string; status: string }[];
};

export type Feature = {
  title: string;
  description: string;
  screen: Screen;
  // Optional real screenshot (data URL) shown instead of the generated mock screen.
  screenshot?: string;
};

export type Storyboard = {
  productName: string;
  tagline: string;
  problem: string;
  navItems: string[];
  features: Feature[];
  stats: { value: string; label: string }[];
  cta: string;
  url: string;
  brandColor: string;
};

export type LaunchVideoProps = {
  storyboard: Storyboard;
};

export const SAMPLE_STORYBOARD: Storyboard = {
  productName: "Orbit",
  tagline: "Project management that keeps your whole team in sync.",
  problem: "Tired of chasing status updates across five different tools?",
  navItems: ["Overview", "Projects", "Tasks", "Reports", "Settings"],
  features: [
    {
      title: "See everything at a glance",
      description: "A live dashboard of every project, deadline and blocker.",
      screen: {
        kind: "chart",
        title: "Team velocity",
        metrics: [
          { label: "Active projects", value: "24" },
          { label: "On track", value: "92%" },
          { label: "Shipped this week", value: "38" },
        ],
        chart: [42, 55, 48, 70, 66, 84, 95],
        rows: [],
      },
    },
    {
      title: "Plan work visually",
      description: "Drag tasks across boards and watch progress update instantly.",
      screen: {
        kind: "board",
        title: "Sprint 14",
        metrics: [
          { label: "To do", value: "12" },
          { label: "In progress", value: "7" },
          { label: "Done", value: "19" },
        ],
        chart: [],
        rows: [
          { title: "Onboarding flow", meta: "Design", status: "To do" },
          { title: "Billing webhooks", meta: "Backend", status: "In progress" },
          { title: "Dark mode", meta: "Frontend", status: "Done" },
          { title: "SSO support", meta: "Security", status: "In progress" },
        ],
      },
    },
    {
      title: "Reports that write themselves",
      description: "Weekly summaries land in Slack without anyone lifting a finger.",
      screen: {
        kind: "table",
        title: "Weekly report",
        metrics: [
          { label: "Hours saved", value: "126" },
          { label: "Reports sent", value: "48" },
          { label: "Read rate", value: "87%" },
        ],
        chart: [],
        rows: [
          { title: "Marketing site relaunch", meta: "Due Fri", status: "On track" },
          { title: "Mobile app v2", meta: "Due Oct 18", status: "At risk" },
          { title: "API v3 migration", meta: "Due Nov 2", status: "On track" },
          { title: "Q4 planning", meta: "Due Oct 30", status: "Done" },
        ],
      },
    },
  ],
  stats: [
    { value: "10x", label: "faster status updates" },
    { value: "5,000+", label: "teams onboard" },
    { value: "99.9%", label: "uptime" },
  ],
  cta: "Start your free trial today",
  url: "orbit.app",
  brandColor: "#6366f1",
};
