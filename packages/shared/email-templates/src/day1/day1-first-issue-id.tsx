import type { ReactElement } from "react";

import {
  Day1FirstIssueEmail,
  type Day1FirstIssueEmailProps,
} from "./day1-first-issue.js";

const Day1FirstIssueIndonesianPreview = (
  props: Day1FirstIssueEmailProps,
): ReactElement => <Day1FirstIssueEmail {...props} />;

Day1FirstIssueIndonesianPreview.PreviewProps = {
  ...Day1FirstIssueEmail.PreviewProps,
  reviewTimeLabel: "09.00 WIB",
  language: "id",
} satisfies Day1FirstIssueEmailProps;

export default Day1FirstIssueIndonesianPreview;
