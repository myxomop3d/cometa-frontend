import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Mail,
  Settings,
  User,
  LogOut,
  Trash2,
  Plus,
  Copy,
  Share,
  Heart,
  Star,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/components/")({
  component: ComponentsPage,
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ComponentsPage() {
  const [checkboxStates, setCheckboxStates] = useState({
    option1: false,
    option2: true,
    option3: false,
  });
  const [menuCheckbox1, setMenuCheckbox1] = useState(true);
  const [menuCheckbox2, setMenuCheckbox2] = useState(false);
  const [menuRadio, setMenuRadio] = useState("comfortable");

  return (
    <div className="max-w-4xl p-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Components</h1>
        <p className="mt-1 text-muted-foreground">
          Showcase of reusable UI components and their variants.
        </p>
      </div>

      {/* ── Button ── */}
      <Section title="Button">
        <SubSection label="Variants">
          <Button variant="default">Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </SubSection>

        <SubSection label="Sizes">
          <Button size="xs">Extra Small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </SubSection>

        <SubSection label="With Icons">
          <Button>
            <Mail data-icon="inline-start" />
            Send Email
          </Button>
          <Button variant="outline">
            <Plus data-icon="inline-start" />
            Create
          </Button>
          <Button variant="secondary">
            <Copy data-icon="inline-start" />
            Copy
          </Button>
          <Button variant="destructive">
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </SubSection>

        <SubSection label="Icon Only">
          <Button size="icon-xs" variant="ghost">
            <Heart />
          </Button>
          <Button size="icon-sm" variant="ghost">
            <Star />
          </Button>
          <Button size="icon" variant="outline">
            <Settings />
          </Button>
          <Button size="icon-lg" variant="outline">
            <Share />
          </Button>
        </SubSection>

        <SubSection label="Disabled">
          <Button disabled>Default</Button>
          <Button variant="outline" disabled>
            Outline
          </Button>
          <Button variant="secondary" disabled>
            Secondary
          </Button>
          <Button variant="destructive" disabled>
            Destructive
          </Button>
        </SubSection>
      </Section>

      {/* ── Checkbox ── */}
      <Section title="Checkbox">
        <SubSection label="States">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checkboxStates.option1}
              onCheckedChange={(checked) =>
                setCheckboxStates((s) => ({
                  ...s,
                  option1: checked as boolean,
                }))
              }
            />
            Unchecked
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checkboxStates.option2}
              onCheckedChange={(checked) =>
                setCheckboxStates((s) => ({
                  ...s,
                  option2: checked as boolean,
                }))
              }
            />
            Checked
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox disabled />
            Disabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked disabled />
            Disabled checked
          </label>
        </SubSection>

        <SubSection label="With Error">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox aria-invalid="true" />
            Invalid checkbox
          </label>
        </SubSection>

        <SubSection label="Form Example">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Select your interests:</p>
            {["Development", "Design", "Marketing"].map((item, i) => {
              const key = `option${i + 1}` as keyof typeof checkboxStates;
              return (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checkboxStates[key]}
                    onCheckedChange={(checked) =>
                      setCheckboxStates((s) => ({
                        ...s,
                        [key]: checked as boolean,
                      }))
                    }
                  />
                  {item}
                </label>
              );
            })}
          </div>
        </SubSection>
      </Section>

      {/* ── Dropdown Menu ── */}
      <Section title="Dropdown Menu">
        <SubSection label="Basic">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" />}
            >
              Open Menu
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  <User />
                  Profile
                  <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings />
                  Settings
                  <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Mail />
                  Messages
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <LogOut />
                Log out
                <DropdownMenuShortcut>Ctrl+Q</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SubSection>

        <SubSection label="With Checkboxes">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Preferences
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={menuCheckbox1}
                  onCheckedChange={setMenuCheckbox1}
                >
                  Show toolbar
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={menuCheckbox2}
                  onCheckedChange={setMenuCheckbox2}
                >
                  Show sidebar
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SubSection>

        <SubSection label="With Radio Items">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Density
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Row Density</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuRadioGroup
                value={menuRadio}
                onValueChange={setMenuRadio}
              >
                <DropdownMenuRadioItem value="compact">
                  Compact
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">
                  Comfortable
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="spacious">
                  Spacious
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SubSection>

        <SubSection label="With Submenu">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              Actions
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Copy />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share />
                Share
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Plus />
                  Add to...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>
                    <Heart />
                    Favorites
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Star />
                    Bookmarks
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SubSection>
      </Section>

      {/* ── Input ── */}
      <Section title="Input">
        <SubSection label="Default">
          <Input placeholder="Type something..." className="max-w-xs" />
        </SubSection>

        <SubSection label="With Value">
          <Input defaultValue="Hello, World!" className="max-w-xs" />
        </SubSection>

        <SubSection label="Disabled">
          <Input
            disabled
            placeholder="Disabled input"
            className="max-w-xs"
          />
        </SubSection>

        <SubSection label="Error State">
          <Input
            aria-invalid="true"
            defaultValue="Invalid value"
            className="max-w-xs"
          />
        </SubSection>

        <SubSection label="File Input">
          <Input type="file" className="max-w-xs" />
        </SubSection>

        <SubSection label="With Icon (composed)">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8" />
          </div>
        </SubSection>

        <SubSection label="Form Example">
          <div className="space-y-3 rounded-lg border border-border p-4 max-w-sm w-full">
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <Input type="password" placeholder="Enter password" />
            </div>
            <Button className="w-full">Sign In</Button>
          </div>
        </SubSection>
      </Section>
    </div>
  );
}
