import { Button, Card } from '@mantine/core';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyBlock } from '../components/StateBlocks';

export default function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Card>
        <EmptyBlock
          title="We could not find that page"
          body="The link may be old, or the page has moved."
          action={
            <Button component={Link} to="/" mt="sm">
              Go to Home
            </Button>
          }
        />
      </Card>
    </>
  );
}
