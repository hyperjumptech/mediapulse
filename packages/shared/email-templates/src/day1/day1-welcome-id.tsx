import type { ReactElement } from "react";

import {
  Day1WelcomeEmail,
  type Day1WelcomeEmailProps,
} from "./day1-welcome.js";

const Day1WelcomeIndonesianPreview = (
  props: Day1WelcomeEmailProps,
): ReactElement => <Day1WelcomeEmail {...props} />;

Day1WelcomeIndonesianPreview.PreviewProps = {
  ...Day1WelcomeEmail.PreviewProps,
  reviewTimeLabel: "09.00 WIB",
  classification: [
    "Infrastruktur",
    "Telekomunikasi",
    "Jasa Telekomunikasi Terintegrasi",
  ],
  language: "id",
} satisfies Day1WelcomeEmailProps;

export default Day1WelcomeIndonesianPreview;
