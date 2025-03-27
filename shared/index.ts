export interface Ticket {
  id: string;
  title: string;
  done_on_child_done: boolean;
  done: string | null;
  last_drawn: string | null;
  deadline: string | null;

  can_draw_monday: boolean;
  must_draw_monday: boolean;
  can_draw_tuesday: boolean;
  must_draw_tuesday: boolean;
  can_draw_wednesday: boolean;
  must_draw_wednesday: boolean;
  can_draw_thursday: boolean;
  must_draw_thursday: boolean;
  can_draw_friday: boolean;
  must_draw_friday: boolean;
  can_draw_saturday: boolean;
  must_draw_saturday: boolean;
  can_draw_sunday: boolean;
  must_draw_sunday: boolean;
}
