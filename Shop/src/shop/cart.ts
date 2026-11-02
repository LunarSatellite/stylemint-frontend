import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi, type AddBundleBody, type AddLineBody, type CartView } from '../api/cart';
import { useSession } from '../auth/session';
import { guestCart, useGuestCart } from './guestCart';

/** One cart API for the pages: the server cart when signed in, the guest cart otherwise. */

export const CART_KEY = ['cart'] as const;

export function useServerCart(enabled: boolean) {
  return useQuery({ queryKey: CART_KEY, queryFn: cartApi.get, enabled });
}

export function useCartCount(): number {
  const s = useSession();
  const guest = useGuestCart();
  const server = useServerCart(s.status === 'signedIn');
  if (s.status === 'signedIn') return (server.data?.itemCount ?? 0) + guest.reduce((n, i) => n + i.body.quantity, 0);
  return guest.reduce((n, i) => n + i.body.quantity, 0);
}

export function useAddLine() {
  const s = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: AddLineBody): Promise<CartView | null> => {
      if (s.status !== 'signedIn') {
        guestCart.addLine(body);
        return null;
      }
      return cartApi.addLine(body);
    },
    onSuccess: (cart) => {
      if (cart) qc.setQueryData(CART_KEY, cart);
    },
  });
}

export function useAddBundle() {
  const s = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, title }: { body: AddBundleBody; title: string }): Promise<CartView | null> => {
      if (s.status !== 'signedIn') {
        guestCart.addBundle(body, title);
        return null;
      }
      return cartApi.addBundle(body);
    },
    onSuccess: (cart) => {
      if (cart) qc.setQueryData(CART_KEY, cart);
    },
  });
}

const LAST_KEY = 'sm_shop_last';

/** `/shop/` sends a returning buyer back to the last thing they looked at. */
export function rememberLastViewed(path: string) {
  try {
    localStorage.setItem(LAST_KEY, path);
  } catch {
    /* ignore */
  }
}

export function lastViewed(): string | null {
  try {
    const p = localStorage.getItem(LAST_KEY);
    return p && /^\/(r|p|b|s)\/[0-9a-f-]{36}$/i.test(p) ? p : null;
  } catch {
    return null;
  }
}
