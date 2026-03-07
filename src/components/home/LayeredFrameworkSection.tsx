import { Layers3, ShieldCheck, CircuitBoard, Radar, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type FrameworkLayer = {
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Layers3;
};

const layers: FrameworkLayer[] = [
  {
    title: "MoF baseline",
    subtitle: "What must exist",
    description:
      "Defines the mandatory UAE invoice data fields your records must contain before technical validation can be trusted.",
    icon: ShieldCheck,
  },
  {
    title: "PINT-AE technical standard",
    subtitle: "How it must behave technically",
    description:
      "Defines format, structure, and rule behavior so invoice data is interoperable and technically compliant.",
    icon: CircuitBoard,
  },
  {
    title: "DRCS readiness engine",
    subtitle: "Whether data can be validated",
    description:
      "Confirms required data exists, can be mapped to canonical fields, and is ready to run through check packs.",
    icon: Radar,
  },
  {
    title: "Reconciliation intelligence",
    subtitle: "How gaps are bridged",
    description:
      "Connects regulation, technical standards, and source-data reality to explain where issues exist and what to fix first.",
    icon: Link2,
  },
];

export function LayeredFrameworkSection() {
  return (
    <section className="mt-8 rounded-3xl surface-glass border border-white/70 p-6 md:p-8">
      <div className="max-w-4xl">
        <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-[11px]">
          Structured control model
        </Badge>
        <h2 className="mt-3 font-display text-2xl md:text-3xl font-semibold text-foreground">
          A layered readiness framework for UAE eInvoicing
        </h2>
        <p className="mt-2 text-sm md:text-base text-muted-foreground">
          DRCS connects UAE mandatory data requirements, technical invoice standards, and operational source-data checks in one structured control model.
        </p>
      </div>

      <div className="relative mt-6">
        <div className="pointer-events-none absolute left-[8%] right-[8%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 md:block" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <Card key={layer.title} className="relative z-10 border-white/70 bg-card/90 shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">{layer.title}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary/90">{layer.subtitle}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{layer.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

