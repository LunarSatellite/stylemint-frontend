import { Component, type ReactNode } from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  resetKey?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  key?: string;
}

/** A page that throws shows this, not a blank screen; navigating elsewhere clears it. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stale = /dynamically imported module|Failed to fetch|Loading chunk/i.test(this.state.error.message);
    return (
      <Alert color="signal" variant="light" icon={<IconAlertTriangle size={18} />} title="This page could not be shown" mt="md">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">
            {stale
              ? 'A newer version of Creator Studio is available. Reload to continue.'
              : 'Something went wrong on our side. Reloading usually fixes it.'}
          </Text>
          <Button size="xs" variant="light" color="signal" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Stack>
      </Alert>
    );
  }
}
