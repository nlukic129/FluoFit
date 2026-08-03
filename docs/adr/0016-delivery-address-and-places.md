# Delivery address + city captured at checkout via Google Places; city drives admin filtering and intake targeting

> Adds the delivery-address model that [ADR-0014](./0014-stack-monorepo-and-ports.md) (ports) and
> the intake model in [agent-affiliate-program §1](../product/agent-affiliate-program.md) (city-targeted
> waves) implicitly assumed. Fulfilment itself stays parked ([PRODUCT "Parked"](../PRODUCT.md#parked-considered-deliberately-deferred)).

## Context

The data model had **no delivery address or city**, yet two live features need the city now:
the Admin **Members** filter (by city) and **intake-wave city targeting** (the program doc says
waves target "the delivery city FluoFit already holds"). Free-text city entry is unreliable
(typos, "Bgd" vs "Beograd") which breaks filtering and targeting. The founder's decision: capture
the delivery address at checkout with **Google Places Autocomplete**, so the city is normalised
and each member is unambiguously tied to a city.

## Decision

- **Delivery address lives on the Subscription** (the thing that ships): `ship_line1`,
  `ship_city`, `ship_postal`, `ship_country`, and **`ship_place_id`** (the Google Places
  identifier). Stored from checkout; also used later by the parked fulfilment work.
- **City is captured via Google Places Autocomplete at checkout.** The user types their address;
  Places returns normalised components — we persist the chosen **city** + **place_id** (and
  line1/postal/country). This gives a canonical city per member, no free-text drift.
- **Google Places is a third-party service → behind a `PlacesPort` adapter** (same pattern as
  Payment/Fulfillment/Payout/Notify — [ADR-0014 §3](./0014-stack-monorepo-and-ports.md)). v1 may
  ship a plain city field / stub until the API key is provisioned; the real Places autocomplete
  is swapped in behind the port without touching the schema or the admin.
- **City powers:** the Admin Members city filter (`fn_admin_list_members` / `fn_admin_member_cities`)
  and intake-wave `city_focus` targeting.
- **Privacy:** the full address is delivery data; only the **city** is used for filtering/targeting
  and shown in admin lists — consistent with "no new data collected beyond fulfilment needs"
  ([program §1](../product/agent-affiliate-program.md)).

## Consequences

- Schema gains delivery-address columns on `subscriptions` (migration `0022`); the Admin member
  list is paginated + filterable by search / status / **city**.
- A **`PlacesPort`** joins the adapter set; real Google Places integration is a port swap (needs
  an API key — an env/secret, not committed).
- **Checkout must collect the address via Places** and pass city + place_id to account creation;
  until the key is wired, a plain city field feeds the same columns so the pipeline (checkout →
  city → admin filter / wave targeting) works end-to-end.
- Fulfilment (parked) already has the address it will need when it unparks.
