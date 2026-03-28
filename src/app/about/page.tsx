'use client'

import AppShell from '@/components/shared/AppShell'
import { ExternalLink, Heart } from 'lucide-react'

const WAYS_TO_CONTRIBUTE = [
  {
    emoji: '🐛',
    titleEn: 'Report a Bug',
    titleZh: '提交 Bug',
    descEn: 'Found something broken? Open an issue on GitHub.',
    descZh: '发现问题？在 GitHub 开一个 Issue。',
    href: 'https://github.com/ruilisi/opc/issues/new',
    linkEn: 'Open issue',
    linkZh: '提交 Issue',
  },
  {
    emoji: '💡',
    titleEn: 'Suggest a Feature',
    titleZh: '建议新功能',
    descEn: 'Have an idea? Share it with the community.',
    descZh: '有好想法？在 GitHub 讨论区分享。',
    href: 'https://github.com/ruilisi/opc/discussions',
    linkEn: 'Start discussion',
    linkZh: '发起讨论',
  },
  {
    emoji: '🔧',
    titleEn: 'Submit a PR',
    titleZh: '提交 PR',
    descEn: 'Fix bugs, add features, or improve docs — all welcome.',
    descZh: '修复 Bug、新增功能、改善文档，欢迎提交 PR。',
    href: 'https://github.com/ruilisi/opc/pulls',
    linkEn: 'View PRs',
    linkZh: '查看 PR',
  },
  {
    emoji: '⭐',
    titleEn: 'Star the Repo',
    titleZh: '给项目点 Star',
    descEn: 'The simplest way to show your support.',
    descZh: '最简单的支持方式，帮助更多人发现这个项目。',
    href: 'https://github.com/ruilisi/opc',
    linkEn: 'Star on GitHub',
    linkZh: '去 GitHub Star',
  },
]

const STACK = [
  'Next.js 16', 'TypeScript', 'Tailwind v4', 'Prisma 7', 'PostgreSQL', 'shadcn/ui',
]

export default function AboutPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-8 p-6 max-w-2xl">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Heart size={20} className="text-rose-500" />
            <h1 className="text-2xl font-bold">加入 OPC</h1>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            OPC 是一个完全开源的项目。它的诞生来自于一个真实的痛点，它的成长需要更多志同道合的人一起推动。
            无论你是开发者、设计师，还是只是一个有想法的用户，都可以参与进来。
          </p>
        </div>

        {/* Ways to contribute */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">参与方式</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {WAYS_TO_CONTRIBUTE.map((item) => (
              <a
                key={item.titleZh}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{item.emoji}</span>
                  <ExternalLink size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.titleZh}</span>
                  <span className="text-xs text-muted-foreground">{item.descZh}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">技术栈</h2>
          <div className="flex flex-wrap gap-2">
            {STACK.map((tech) => (
              <span key={tech} className="rounded-md border bg-muted px-2.5 py-1 text-xs font-mono">
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* GitHub link */}
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <span className="shrink-0 text-xl">⚙️</span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">ruilisi/opc</span>
            <span className="text-xs text-muted-foreground">MIT License · 完全开源</span>
          </div>
          <a
            href="https://github.com/ruilisi/opc"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            GitHub →
          </a>
        </div>

        {/* Sponsor */}
        <div className="flex flex-col gap-2 rounded-lg border p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground">本项目由以下赞助商支持：</p>
          <a
            href="https://game.lingti.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://files.lingti.com/images/lingti-logo-圆形不带字.png" alt="灵缇AI加速" className="size-6 rounded-full" />
            <span className="text-sm font-medium">灵缇AI加速</span>
            <span className="text-xs text-muted-foreground">game.lingti.com</span>
          </a>
        </div>
      </div>
    </AppShell>
  )
}
