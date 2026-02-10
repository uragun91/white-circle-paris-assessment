import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const userPhrases = [
  'Привет! Подскажи, как начать проект на Next.js?',
  'Объясни разницу между SSE и WebSocket.',
  'Как оптимизировать рендеринг в React?',
  'Какая сложность у бинарного поиска?',
  'Как подключить Postgres в Next.js?'
]

const assistantPhrases = [
  'Здравствуйте! Для начала создайте новый проект через create-next-app...',
  'SSE — однонаправленный поток сервер→клиент, WebSocket — двунаправленный канал.',
  'Используйте мемоизацию, React.lazy и избегайте лишних перерендеров.',
  'В среднем O(log n) по времени и O(1) по памяти.',
  'Через Prisma: настройте DATABASE_URL и выполните миграции.'
]

async function makeChat(index) {
  const title = `Чат #${index + 1}`
  const msgCount = randInt(3, 8)
  const messages = []
  for (let i = 0; i < msgCount; i++) {
    const isUser = i % 2 === 0
    messages.push({
      role: isUser ? 'user' : 'assistant',
      content: isUser
        ? userPhrases[randInt(0, userPhrases.length - 1)]
        : assistantPhrases[randInt(0, assistantPhrases.length - 1)],
      createdAt: new Date(Date.now() - randInt(0, 7) * 24 * 60 * 60 * 1000)
    })
  }

  return prisma.chat.create({
    data: {
      title,
      messages: { create: messages }
    }
  })
}

async function main() {
  // Clean existing
  await prisma.message.deleteMany()
  await prisma.chat.deleteMany()

  // Create 4 chats
  for (let i = 0; i < 4; i++) {
    await makeChat(i)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('Seed completed')
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
