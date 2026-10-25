// Question bank: realistic scam + legit scenarios.
// Each: channel, sender, message, isScam (true = scam/phish), redFlag (why), source note.
module.exports = [
  {
    channel: "SMS", sender: "VM-XYKYC",
    message: "Dear customer, your bank account will be BLOCKED today. Complete KYC immediately: bit.ly/kyc-update-4471",
    isScam: true,
    redFlag: "Urgency + shortened link. Banks never ask you to complete KYC via a bit.ly link in an SMS."
  },
  {
    channel: "SMS", sender: "SBI Bank",
    message: "Rs. 2,500 debited from A/c **4821 on 24-Oct. If not done by you, call the number on the back of your card. Never share OTP with anyone.",
    isScam: false,
    redFlag: "Legit: no link, no request for details, and it tells you NOT to share your OTP — scammers do the opposite."
  },
  {
    channel: "WhatsApp", sender: "+234 810 ••• ••42",
    message: "Hello dear, I am HR from a big company. Part-time job, earn ₹5,000/day just liking YouTube videos. Pay ₹500 registration to start.",
    isScam: true,
    redFlag: "Foreign number, unrealistic pay for trivial work, and an upfront 'registration fee' — a classic task scam."
  },
  {
    channel: "Email", sender: "security@paypa1-secure.com",
    message: "We detected unusual activity. Verify your identity within 24 hours or your account will be permanently closed. [Verify Now]",
    isScam: true,
    redFlag: "Look closely: 'paypa1' uses the number 1, not the letter l. Fake domain + threat of closure = phishing."
  },
  {
    channel: "Call", sender: "Unknown caller",
    message: "\"This is CBI officer speaking. A parcel in your name contains illegal items. You are under digital arrest — do not disconnect, transfer money to this 'safe account' for verification.\"",
    isScam: true,
    redFlag: "'Digital arrest' does not exist. Police/CBI never demand money transfers on a call to 'verify' you."
  },
  {
    channel: "SMS", sender: "AD-ELECBRD",
    message: "Your electricity will be disconnected tonight at 9 PM due to unpaid bill. Call our officer immediately on 98••• ••210 to update payment.",
    isScam: true,
    redFlag: "Power boards don't threaten same-night disconnection by SMS or ask you to call a personal mobile number."
  },
  {
    channel: "Email", sender: "noreply@github.com",
    message: "A new sign-in was detected on your account from Chrome on Windows, Jaipur, India. If this wasn't you, secure your account from Settings > Security.",
    isScam: false,
    redFlag: "Legit: real domain, no credential-harvesting link, directs you to the app's own Settings — standard security alert."
  },
  {
    channel: "WhatsApp", sender: "Mom (new number)",
    message: "Hi beta, this is my new number, my phone broke. I urgently need ₹18,000 for a bill, please send to this UPI quickly, will explain later.",
    isScam: true,
    redFlag: "Impersonation + urgency + new number. Always voice-call the OLD number to verify before sending money."
  },
  {
    channel: "SMS", sender: "UPI Alert",
    message: "You have received a collect request of ₹4,999 from shop-pay@okbiz. Enter your UPI PIN to RECEIVE the money.",
    isScam: true,
    redFlag: "You NEVER enter a UPI PIN to receive money. A PIN is only for paying. This 'collect request' would debit you."
  },
  {
    channel: "Email", sender: "hr@careers-google-jobs.in",
    message: "Congratulations! You are selected for a Google internship. To reserve your slot, pay a refundable security deposit of ₹2,999 today.",
    isScam: true,
    redFlag: "Real companies never charge a 'refundable deposit' for a job or internship. Unofficial domain is another giveaway."
  },
  {
    channel: "SMS", sender: "VM-COURIER",
    message: "Your parcel is held at customs. Pay ₹48 clearance fee to release: track-parcel-india.xyz/pay",
    isScam: true,
    redFlag: "Tiny 'fee' on a suspicious .xyz domain — designed to steal your card details, not release a parcel."
  },
  {
    channel: "Email", sender: "billing@netflix.com",
    message: "Your payment method was declined. Update it by signing in to Netflix and going to Account > Billing. We will never ask for payment details by email.",
    isScam: false,
    redFlag: "Legit: real domain, tells you to sign in yourself, and states they never ask for payment details by email."
  },
  {
    channel: "WhatsApp", sender: "Cousin (voice note)",
    message: "A voice note in your cousin's exact voice: \"I'm stuck at the airport, phone is dying, send ₹25,000 to this number right now, please don't call back.\"",
    isScam: true,
    redFlag: "AI voice cloning is real. 'Don't call back' is the tell — verify via a family code word or a separate call."
  },
  {
    channel: "SMS", sender: "AD-BANKOTP",
    message: "Your OTP for a transaction of ₹1 is 483920. Valid for 10 minutes. Do NOT share this OTP with anyone, including bank staff.",
    isScam: false,
    redFlag: "Legit pattern: the OTP came to you unsolicited for YOUR transaction and warns against sharing. It becomes a scam only if someone calls asking for it."
  },
  {
    channel: "Email", sender: "support@amazon-offers-win.com",
    message: "You have won a FREE iPhone 16 in our anniversary lucky draw! Claim in 2 hours — just pay ₹199 shipping.",
    isScam: true,
    redFlag: "You can't win a draw you never entered. 'Free prize, just pay shipping' on a lookalike domain = scam."
  },
  {
    channel: "Call", sender: "Bank 'manager'",
    message: "\"Sir, your card is being misused. To block it, read me the OTP you just received so I can verify it's really you.\"",
    isScam: true,
    redFlag: "No bank employee will EVER ask for an OTP. The OTP is the key to your account — reading it out hands over the money."
  },
  {
    channel: "SMS", sender: "TRAI Info",
    message: "All mobile numbers not linked with Aadhaar in 24 hours will be deactivated. Update here: trai-update-portal.com",
    isScam: true,
    redFlag: "TRAI never sends such threats or update links. Fear + deadline + external portal = social engineering."
  },
  {
    channel: "Email", sender: "team@openai.com",
    message: "Your receipt for ChatGPT Plus — $20.00 charged to card ending 4417. View your invoice any time under Settings > Billing in ChatGPT.",
    isScam: false,
    redFlag: "Legit: real domain, matches a real subscription, no urgent action or credential request — just a receipt."
  },
  {
    channel: "WhatsApp", sender: "Investment Guru group",
    message: "Guaranteed 300% returns in 30 days! Our SEBI-registered experts double your money. Transfer today, limited seats only!!",
    isScam: true,
    redFlag: "'Guaranteed returns' are illegal to promise and impossible. Pressure + limited seats = pump-and-dump fraud."
  },
  {
    channel: "SMS", sender: "VK-AIRLN",
    message: "Your flight 6E-2041 on 28-Oct is rescheduled to depart 40 min early. Check-in closes 45 min before departure. Manage booking in the airline app.",
    isScam: false,
    redFlag: "Legit: specific verifiable flight details, no payment or credential request, directs you to the official app."
  },
  {
    channel: "Email", sender: "it-helpdesk@yourcompany-secure-login.com",
    message: "Mandatory password reset: your work password expires in 1 hour. Reset now: [link] Failure will lock your account before your shift.",
    isScam: true,
    redFlag: "External lookalike domain + 1-hour panic deadline. Real IT resets happen inside the company portal, not via emailed panic links."
  },
  {
    channel: "SMS", sender: "JM-REFUND",
    message: "Refund of ₹1,250 for your returned order has been credited to your original payment method. Ref ID: RF88213. No action needed.",
    isScam: false,
    redFlag: "Legit: money credited to the ORIGINAL method, a reference ID, and explicitly no action needed — scammers always need you to act."
  },
  {
    channel: "WhatsApp", sender: "Landlord",
    message: "A photo of a QR code: \"Scan this to get your security deposit back. Just enter your UPI PIN to confirm receipt.\"",
    isScam: true,
    redFlag: "Scanning a QR + entering a PIN PAYS money, it never receives it. Deposit-refund QR scams drain accounts."
  },
  {
    channel: "Email", sender: "admissions@manipal.edu",
    message: "Your semester fee receipt and enrolment confirmation are attached. View your full record on the student portal using your university login.",
    isScam: false,
    redFlag: "Legit: official university domain, informational only, points to the portal you already use — no payment link or urgency."
  }
];
