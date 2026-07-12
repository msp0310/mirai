export type TourId = "basic" | "gantt" | "member" | "planner" | "admin";

export type TourStep = {
  body: string;
  selector: string;
  title: string;
};

export type TourScenario = {
  description: string;
  id: TourId;
  steps: TourStep[];
  title: string;
};
