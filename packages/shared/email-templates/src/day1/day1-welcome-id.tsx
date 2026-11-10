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
  overview:
    "Operator telekomunikasi terintegrasi yang melayani pelanggan seluler, fiber rumah dan korporasi di seluruh Indonesia, dengan jaringan tulang punggung fiber terbesar di luar BUMN.",
  businessOperation:
    "Menjual paket seluler prabayar dan pascabayar, bundel internet fiber rumah dan konektivitas terkelola untuk korporasi. Menyewakan kapasitas menara dan fiber kepada operator lain.",
  classification: [
    "Infrastruktur",
    "Telekomunikasi",
    "Jasa Telekomunikasi Terintegrasi",
  ],
  language: "id",
} satisfies Day1WelcomeEmailProps;

export default Day1WelcomeIndonesianPreview;
