---
name: email-template
description: Create email templates using React Email in the @workspace/email-templates package. Use when the user asks to create, add, build, or scaffold an email template, transactional email, or mentions React Email, email-templates, or @react-email/components.
---

# Email Template Creation

Create email templates in `packages/email-templates/src/` using `@react-email/components`.

## File Conventions

- Place templates in a **domain subfolder**: `src/user/`, `src/order/`, `src/billing/`, etc.
- File names in **kebab-case**: `password-forgot.tsx`, `order-confirmation.tsx`.
- No `index.tsx` files inside subfolders -- each template is a standalone file.

## Required Exports

Every template file must export exactly these four things:

1. **Props interface** -- named `{ComponentName}Props`.
2. **Named const component** -- arrow function typed as `React.JSX.Element`.
3. **PreviewProps** -- static property on the component with sample data, using `satisfies`.
4. **Default export** -- the component.

```tsx
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

export interface InviteEmailProps {
  inviterName: string;
  inviteUrl: string;
}

/**
 * Email sent when a user is invited to join a workspace.
 *
 * @param props.inviterName - Name of the person who sent the invite.
 * @param props.inviteUrl - URL the recipient clicks to accept.
 * @returns The invite email React Email component.
 */
export const InviteEmail = ({
  inviterName,
  inviteUrl,
}: InviteEmailProps): React.JSX.Element => {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to join</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              You're invited!
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              {inviterName} invited you to join the workspace.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

InviteEmail.PreviewProps = {
  inviterName: "Jane",
  inviteUrl: "https://example.com/invite?token=abc",
} satisfies InviteEmailProps;

export default InviteEmail;
```

## Styling

- Use Tailwind CSS for styling via the `<Tailwind>` component from `@react-email/components`.
- Wrap the main `<Body>` or the entire `<Html>` content inside the `<Tailwind>` tag to apply classes.
- Avoid using plain `React.CSSProperties` objects unless explicitly necessary for dynamic styles.
- Example: `<Heading className="text-2xl font-bold text-gray-800">` instead of `<Heading style={heading}>`.

## After Creating a Template

Run the codegen script to regenerate the template registry:

```bash
pnpm --filter @workspace/email-templates generate
```

This updates `src/index.ts` with the new template's entry in `TemplateMap` and `templates`. The generated file must not be edited by hand.

## Checklist

Before finalizing a template:

- [ ] File is in a domain subfolder under `src/` (e.g., `src/user/`)
- [ ] File name is kebab-case
- [ ] Exports an `interface` ending in `Props`
- [ ] Exports a named `const` arrow-function component with JSDoc
- [ ] Component return type is `React.JSX.Element`
- [ ] `PreviewProps` set with `satisfies {PropsType}`
- [ ] Default export of the component
- [ ] Styles are implemented using Tailwind CSS classes inside a `<Tailwind>` wrapper
- [ ] Co-located `.test.tsx` with 100% coverage (renders HTML containing key props)
- [ ] Ran `pnpm --filter @workspace/email-templates generate`
