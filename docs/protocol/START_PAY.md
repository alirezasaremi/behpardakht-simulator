# StartPay / payment page

## Verified v1.39 facts (`PROTOCOL`)

Printed source page 14 says a successful Pay (`ResCode` `0`) sends generated case-sensitive `RefId` to payment page by HTTP POST. Production URLs are documentation only; simulator never impersonates them:

- Test Persian: `https://pgw.dev.bpmellat.ir/pgwchannel/startpay.mellat`
- Test English: `https://pgw.dev.bpmellat.ir/pgwchannel/enstartpay.mellat`
- Operational Persian: `https://bpm.shaparak.ir/pgwchannel/startpay.mellat`
- Operational English: `https://bpm.shaparak.ir/pgwchannel/enstartpay.mellat`
- Operational Iranian-goods credit: `https://bpm.shaparak.ir/pgwCreditchannel/startpay.mellat`

Printed pages 18-20 illustrate `MobileNo`, `EncPan` with `HiddenMode`, `merchantName`, `merchantAddress`, `GamBonds`, and `SettleTime` alongside `RefId`. `SettleTime` with any value changes documented automatic-settlement timing to six hours. Printed page 16 identifies Pay-table optional input names as `mobileNo`, `encPan`, and `panHiddenMode`; examples use different casing for redirect fields. No casing normalization is inferred.

Printed page 16 says `RefId` is case-sensitive and must be sent exactly to destination. Printed page 17 states the production redirect checks a `Referer` domain/subdomain against merchant configuration.

## Local Goal 4 behavior (`SIMULATOR_INTERNAL`)

`POST /local/start-pay` is a local-only endpoint. It accepts bounded `application/x-www-form-urlencoded` with exactly `RefId`, validates lookup, and sends a local 303 to `/local/payment/[RefId]`; these HTTP response details are not claimed production behavior. Unknown RefId returns a local safe 404.

Goal 4 does not accept, display, persist, or implement optional StartPay fields. `MobileNo`, `EncPan`, `HiddenMode`, `merchantName`, `merchantAddress`, `GamBonds`, and `SettleTime` are explicitly rejected as unsupported local form fields. In particular this prevents intake of card-like data and avoids implementing future settlement behavior.

Payment page uses stored Pay transaction only. Its POST actions have fixed success/non-success outcomes, no GET mutation, and reject duplicate submissions. A browser `Origin` must match either local request origin or actual inbound local `Host`; this deliberately supports `127.0.0.1` when development runtime canonicalizes its request URL to `localhost`, while rejecting cross-origin browser posts. It has no card/PAN/PIN/CVV2/expiry/OTP/banking-credential fields and is visibly a fake local simulator, not a Behpardakht/Shaparak clone.
