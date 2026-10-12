import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface Props {
  /** Changes when the operator moves to another page, so one broken page does not take the others with it. */
  resetKey?: string;
  children: ReactNode;
}

interface State {
  error: unknown;
  resetKey?: string;
}

/** What an operator sees when a page fails while drawing, instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('unknown') };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // A chunk from before a release: one reload fetches the new one.
    const message = error instanceof Error ? error.message : '';
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)) {
      try {
        if (!sessionStorage.getItem('sm.chunkReload')) {
          sessionStorage.setItem('sm.chunkReload', '1');
          window.location.reload();
          return;
        }
      } catch {
        // fall through to the message
      }
    }
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <Alert variant="light" color="signal" icon={<IconAlertTriangle size={18} />} title="This page hit a problem" m="lg" data-testid="error-boundary">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">Nothing was changed. Reloading usually fixes it; if it keeps happening, tell the platform team which page and when.</Text>
          <Button size="xs" variant="light" color="signal" leftSection={<IconRefresh size={14} />} onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Stack>
      </Alert>
    );
  }
}
