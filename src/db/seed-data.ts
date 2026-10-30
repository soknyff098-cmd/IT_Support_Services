// The four requested accounts are seeded only in an empty store. Passwords are stored as scrypt hashes.
export const ACCOUNT_SETUP_MIGRATION = "legacy_named_accounts_v1";

export interface SeedUserDef {
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "agent" | "user";
  department: string;
  avatarColor: string;
  legacyFullName: string;
  initialPasswordHash: string;
}

export const SEED_USERS: SeedUserDef[] = [
  {
    username: "admin",
    email: "admin@helpdesk.com",
    fullName: "ហុន ភារះ",
    legacyFullName: "សុខ វិបុល (System Admin)",
    initialPasswordHash: "scrypt:1c6bbf6a6c3762662e98cc9821db2c09:4aa60a45b33b3c7362e0f4a9de034db30dbc1863d469509dd4f5a877ffa8d65ed201be571103ff49b56a1a0905db38b529ecf83321b416f4afa4fb9581e70ad9",
    role: "admin",
    department: "ព័ត៌មានវិទ្យា (IT Management)",
    avatarColor: "#2563eb",
  },
  {
    username: "agent",
    email: "agent@helpdesk.com",
    fullName: "វឿន រ៉ាវីត",
    legacyFullName: "ចាន់ តារា (IT Support)",
    initialPasswordHash: "scrypt:5fbbfacf25f6288f0a23713a581499d6:5bf4c6e8cb0a259f3be3c7c993a8b72abfeee36d6a5cec8e0166e7a0fbc1ac2dcb229a26b83e07de0d955c8e9f77370fdca04ca95212ed10a40b6570e99a646f",
    role: "agent",
    department: "ក្រុមបច្ចេកទេស (Tech Support)",
    avatarColor: "#0891b2",
  },
  {
    username: "agent2",
    email: "agent2@helpdesk.com",
    fullName: "ជា បញ្ញា",
    legacyFullName: "លី ស្រីនាថ (Network Specialist)",
    initialPasswordHash: "scrypt:ba7dc48f9e322a03c24c2d8eebd01801:5c4ca150999237ff7829cd53c8d8f1877a1c330ced775f085013f3f75aba4ed293d9e7798f6a8594f04a4fe0f6fad76bef34b5470c9bf727fd117c591cdd7742",
    role: "agent",
    department: "បណ្ដាញ និងសុវត្ថិភាព (Network & Security)",
    avatarColor: "#7c3aed",
  },
  {
    username: "user",
    email: "user@helpdesk.com",
    fullName: "សាន សុខនី",
    legacyFullName: "កែវ សុភា (Staff User)",
    initialPasswordHash: "scrypt:77d00043febcfecddcec7d50c1a83838:4001cdd145fca2367e6edbc6acec2aa53a9a84efa711ac734a2881d053d1d2baa631b45cec19cd12c680f6cffcb698f675b187a82bc3cec70314b2e9fab16cc2",
    role: "user",
    department: "គណនេយ្យ និងហិរញ្ញវត្ថុ (Finance)",
    avatarColor: "#059669",
  },
];

export const SEED_CATEGORIES = [
  {
    name: "បញ្ហាកុំព្យូទ័រ និងឧបករណ៍ (Hardware)",
    description:
      "ម៉ាស៊ីនកុំព្យូទ័រ ម៉ាស៊ីនបោះពុម្ព (Printer) ម៉ូនីទ័រ ឬឧបករណ៍ខូច",
    color: "#2563eb",
    slaHours: 12,
  },
  {
    name: "បណ្ដាញ និងអ៊ីនធឺណិត (Network & Wi-Fi)",
    description: "អ៊ីនធឺណិតយឺត ដាច់ Wi-Fi ឬមិនអាចភ្ជាប់ VPN បាន",
    color: "#0891b2",
    slaHours: 4,
  },
  {
    name: "កម្មវិធី និងប្រព័ន្ធ (Software & ERP)",
    description:
      "ដំឡើងកម្មវិធី បញ្ហា Microsoft Office អ៊ីមែល ឬប្រព័ន្ធការងារ",
    color: "#7c3aed",
    slaHours: 8,
  },
  {
    name: "គណនី និងសិទ្ធិប្រើប្រាស់ (Account & Login)",
    description:
      "ភ្លេចពាក្យសម្ងាត់ ចូលគណនីមិនបាន ឬស្នើសុំបើកសិទ្ធិថ្មី",
    color: "#d97706",
    slaHours: 2,
  },
  {
    name: "សំណើទូទៅផ្សេងៗ (General Request)",
    description: "ការសាកសួរ ឬសំណើជំនួយបច្ចេកទេសទូទៅក្នុងការិយាល័យ",
    color: "#059669",
    slaHours: 24,
  },
];

export function createInitialSeedDataset() {
  const nowIso = new Date().toISOString();

  const users = SEED_USERS.map((u, idx) => ({
    id: idx + 1,
    username: u.username,
    email: u.email,
    passwordHash: u.initialPasswordHash,
    fullName: u.fullName,
    role: u.role,
    department: u.department,
    avatarColor: u.avatarColor,
    avatarUrl: null as string | null,
    isActive: true,
    createdAt: nowIso,
  }));

  const categories = SEED_CATEGORIES.map((c, idx) => ({
    id: idx + 1,
    name: c.name,
    description: c.description,
    color: c.color,
    slaHours: c.slaHours,
    createdAt: nowIso,
  }));

  const tickets = [
    {
      id: 1,
      ticketCode: "HD-1001",
      title: "ភ្ជាប់ Wi-Fi ជាន់ទី ២ មិនបានតាំងពីព្រឹកមិញ",
      description:
        "បុគ្គលិកផ្នែកគណនេយ្យទាំងអស់នៅជាន់ទី ២ មិនអាចភ្ជាប់ទៅកាន់ Office-WiFi-5G បានទេ លោតសញ្ញាឧទានពណ៌លឿង។ សូមជួយពិនិត្យ Router បន្ទាន់។",
      status: "in_progress",
      priority: "urgent",
      categoryId: 2,
      requesterId: 4,
      assigneeId: 3,
      location: "ជាន់ទី ២ - បន្ទប់គណនេយ្យ",
      resolvedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 2,
      ticketCode: "HD-1002",
      title: "ម៉ាស៊ីន Printer HP LaserJet ជាប់ក្រដាស និងលោតភ្លើងក្រហម",
      description:
        "ពេលបោះពុម្ពរបាយការណ៍ប្រចាំខែ ម៉ាស៊ីនបោះពុម្ពជាប់ក្រដាសនៅខាងក្នុង ហើយលោតកូដ Error 50.2។",
      status: "open",
      priority: "high",
      categoryId: 1,
      requesterId: 4,
      assigneeId: 2,
      location: "ជាន់ទី ១ - បន្ទប់រដ្ឋបាល",
      resolvedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 3,
      ticketCode: "HD-1003",
      title: "ស្នើសុំកំណត់ពាក្យសម្ងាត់ (Reset Password) ក្នុងប្រព័ន្ធអ៊ីមែលក្រុមហ៊ុន",
      description:
        "ខ្ញុំបានប្ដូរទូរស័ព្ទថ្មី ហើយចូលគណនីអ៊ីមែលការងារមិនបានទេ សូមជួយកំណត់ពាក្យសម្ងាត់ថ្មី និងភ្ជាប់ 2FA ឡើងវិញ។",
      status: "resolved",
      priority: "medium",
      categoryId: 4,
      requesterId: 4,
      assigneeId: 2,
      location: "ជាន់ទី ៣ - ផ្នែកធនធានមនុស្ស",
      resolvedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 4,
      ticketCode: "HD-1004",
      title:
        "ស្នើសុំដំឡើងកម្មវិធី Microsoft Excel និងពុម្ពអក្សរខ្មែរ Unicode សម្រាប់បុគ្គលិកថ្មី",
      description:
        "មានបុគ្គលិកថ្មីចូលធ្វើការថ្ងៃចន្ទក្រោយ ចំនួន ២ នាក់ សូមជួយរៀបចំកុំព្យូទ័រ ដំឡើង Office និងពុម្ពអក្សរ Khmer OS Siemreap / Battambang។",
      status: "open",
      priority: "low",
      categoryId: 3,
      requesterId: 1,
      assigneeId: null,
      location: "ជាន់ទី ២ - ផ្នែកទីផ្សារ",
      resolvedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const ticketComments = [
    {
      id: 1,
      ticketId: 1,
      authorId: 3,
      message: "ខ្ញុំកំពុងចុះទៅពិនិត្យ Access Point នៅជាន់ទី ២ ឥឡូវនេះហើយ។",
      isInternal: false,
      createdAt: nowIso,
    },
    {
      id: 2,
      ticketId: 1,
      authorId: 3,
      message:
        "កំណត់ត្រាបច្ចេកទេស៖ DHCP pool ពេញលើ VLAN 20 កំពុងពង្រីក subnet range។",
      isInternal: true,
      createdAt: nowIso,
    },
    {
      id: 3,
      ticketId: 3,
      authorId: 2,
      message:
        "បានកំណត់ពាក្យសម្ងាត់ថ្មី និងផ្ញើជូនតាម Telegram រួចរាល់ហើយ សូមសាកល្បងចូលម្ដងទៀត។",
      isInternal: false,
      createdAt: nowIso,
    },
  ];

  return { users, categories, tickets, ticketComments, appliedMigrations: [ACCOUNT_SETUP_MIGRATION] };
}
