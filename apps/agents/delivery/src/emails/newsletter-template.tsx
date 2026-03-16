import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";
import React from "react";

export interface NewsletterTemplateProps {
  subject: string;
  content: string;
}

/**
 * Professional newsletter template for Mediapulse.
 *
 * @param props.subject - Newsletter subject line.
 * @param props.content - Newsletter main content/body.
 * @returns The newsletter React Email component.
 */
export const NewsletterTemplate = ({
  subject,
  content,
}: NewsletterTemplateProps): React.JSX.Element => {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Tailwind>
        <Body className="bg-[#f6f9fc] font-sans my-auto mx-auto px-4 py-8">
          <Container className="bg-white border border-solid border-[#e5e7eb] rounded-lg my-[40px] mx-auto p-[32px] w-[600px] shadow-sm">
            <Heading className="text-gray-900 text-[28px] font-bold text-center p-0 my-[16px] mx-0 tracking-tight">
              {subject}
            </Heading>
            <div className="bg-gray-50 rounded px-6 py-4 my-[24px]">
              <Text className="text-gray-700 text-[16px] leading-[26px] whitespace-pre-wrap m-0">
                {content}
              </Text>
            </div>
            <Text className="text-gray-500 text-[12px] leading-[20px] text-center mt-[32px]">
              Mediapulse Newsletter Management<br />
              This email was automatically triggered by your agent pipelines.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

NewsletterTemplate.PreviewProps = {
  subject: "Mediapulse Daily Snapshot: Tech Trends",
  content: "Here is your customized summary of the latest movements in the tech industry. AI models continue to evolve, and we see significant market shifts in semiconductor stocks. Stay tuned for deeper analysis.",
} satisfies NewsletterTemplateProps;

export default NewsletterTemplate;
