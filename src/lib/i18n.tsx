'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Lang = 'en' | 'zh'

const translations = {
  en: {
    // Nav
    nav_boards: 'Boards',
    nav_sentry: 'Sentry',
    nav_org_settings: 'Org Settings',
    nav_settings: 'Settings',
    // Theme
    theme_light: 'Light',
    theme_dark: 'Dark',
    theme_system: 'Match system',
    // Lang
    lang_en: 'English',
    lang_zh: '中文',
    // Workspace switcher
    ws_personal: 'Personal',
    ws_create_org: 'Create Organization',
    ws_edit_profile: 'Edit Profile',
    ws_logout: 'Logout',
    ws_loading: 'Loading...',
    // Login
    login_tagline: 'Project Management',
    login_button: 'Login',
    // Boards page
    boards_title: 'Boards',
    boards_new: 'New Board',
    boards_empty_title: 'No boards yet',
    boards_empty_desc: 'Create your first board to get started.',
    // Board card
    boards_columns_one: '1 column',
    boards_columns_other: (n: number) => `${n} columns`,
    // Create board dialog
    create_board_title: 'Create Board',
    create_board_name: 'Name',
    create_board_desc: 'Description (optional)',
    create_board_name_ph: 'My Project',
    create_board_desc_ph: 'What is this board for?',
    create_board_submit: 'Create Board',
    create_board_creating: 'Creating...',
    create_board_success: 'Board created',
    create_board_error: 'Failed to create board',
    // Delete board dialog
    delete_board_title: 'Delete board',
    delete_board_warning: 'This action is permanent and cannot be undone. All columns and tasks inside will be deleted.',
    delete_board_confirm_prefix: 'Type',
    delete_board_confirm_suffix: 'to confirm',
    delete_board_submit: 'Delete this board',
    delete_board_deleting: 'Deleting...',
    delete_board_success: 'Board deleted',
    delete_board_error: 'Failed to delete board',
    // Create org dialog
    create_org_btn: 'New Organization',
    create_org_title: 'Create Organization',
    create_org_name_label: 'Organization name',
    create_org_name_ph: 'Acme Corp',
    create_org_slug_label: 'URL identifier',
    create_org_slug_ph: 'acme-corp',
    create_org_slug_taken: 'This identifier is already taken. Please choose another.',
    create_org_slug_available: 'This identifier is available.',
    create_org_slug_hint: "Used in URLs and can't be changed later.",
    create_org_submit: 'Create Organization',
    create_org_creating: 'Creating...',
    create_org_success: 'Organization created',
    create_org_error: 'Failed to create organization',
    create_org_slug_taken_toast: 'That URL is already taken — try another',
    // Invite link card
    invite_title: 'Invite Members',
    invite_generate: 'Generate Invite Link',
    invite_generating: 'Generating...',
    invite_copied: 'Link copied!',
    invite_error: 'Failed to generate invite link',
    // Kanban column
    column_add_ph: 'Enter a title for this card…',
    column_add_card: 'Add card',
    column_add_a_card: 'Add a card',
    column_create_error: 'Failed to create card',
    column_rename: 'Rename',
    column_delete: 'Delete Column',
    column_rename_error: 'Failed to rename column',
    column_delete_error: 'Failed to delete column',
    // Kanban board filter
    board_filter: 'Filter',
    board_labels: 'Labels',
    board_members: 'Members',
    board_due_date: 'Due Date',
    board_due_none: 'No due date',
    board_due_overdue: 'Overdue',
    board_due_today: 'Today',
    board_due_upcoming: 'Upcoming',
    board_clear_filters: 'Clear all filters',
    board_add_column: 'Add Column',
    board_add_column_prompt: 'Column name:',
    board_column_error: 'Failed to add column',
    board_column_pos_error: 'Failed to save column position',
    board_task_pos_error: 'Failed to save position',
    // Board header
    board_base_folder: 'Base Folder',
    board_agent_tokens: 'Agent Tokens',
    board_base_folder_error: 'Failed to save base folder',
    // Org settings page
    org_rename_section: 'Rename',
    org_save: 'Save',
    org_saving: 'Saving...',
    org_members_section: 'Members',
    org_danger_zone: 'Danger Zone',
    org_delete_confirm: 'Delete this organization and all its boards? This cannot be undone.',
    org_delete_yes: 'Yes, delete',
    org_cancel: 'Cancel',
    org_delete_btn: 'Delete Organization',
    org_deleting: 'Deleting...',
    org_rename_success: 'Organization renamed',
    org_rename_error: 'Failed to rename organization',
    org_remove_member_success: 'Member removed',
    org_remove_member_error: 'Failed to remove member',
    org_delete_success: 'Organization deleted',
    org_delete_error: 'Failed to delete organization',
    org_not_found: 'Organization not found.',
    // Profile page
    profile_title: 'Profile',
    profile_display_name: 'Display Name',
    profile_save: 'Save Changes',
    profile_saving: 'Saving...',
    profile_success: 'Profile updated',
    profile_error: 'Failed to update profile',
    // Settings page
    settings_title: 'Settings',
    settings_qiniu_title: 'Qiniu Storage',
    settings_qiniu_desc: 'Configure image uploads via Qiniu CDN',
    settings_qiniu_success: 'Qiniu settings saved',
    settings_qiniu_error: 'Failed to save',
    settings_sentry_title: 'Sentry Configs',
    settings_sentry_desc: 'Monitor errors across projects',
    settings_sentry_add: 'Add',
    settings_sentry_name_label: 'Config name (optional)',
    settings_sentry_org_label: 'Organization slug',
    settings_sentry_token_label: 'Auth token',
    settings_sentry_fetch: 'Fetch Projects',
    settings_sentry_fetching: 'Fetching...',
    settings_sentry_cancel: 'Cancel',
    settings_sentry_back: '← Back',
    settings_sentry_select_label: 'Select project',
    settings_sentry_found: (n: number, org: string) => `Found ${n} project${n !== 1 ? 's' : ''} in ${org}`,
    settings_sentry_save: 'Add Config',
    settings_sentry_saving: 'Saving...',
    settings_sentry_empty: 'No Sentry configs yet.',
    settings_sentry_success: 'Sentry config added',
    settings_sentry_error: 'Failed to add config',
    settings_sentry_delete_success: 'Deleted',
    settings_sentry_delete_error: 'Failed to delete',
    settings_sentry_fetch_error: 'Failed to fetch projects',
    settings_token_title: 'API Tokens',
    settings_token_desc: 'For CLI and skill access. Tokens are shown only once.',
    settings_token_new_label: 'New token (copy it now — it will not be shown again):',
    settings_token_copy: 'Copy',
    settings_token_ph: 'Token name',
    settings_token_generate: 'Generate',
    settings_token_empty: 'No tokens yet.',
    settings_token_copied: 'Copied',
    settings_token_error: 'Failed to create token',
    settings_token_revoke_error: 'Failed',
    save: 'Save',
  },
  zh: {
    // Nav
    nav_boards: '看板',
    nav_sentry: '错误监控',
    nav_org_settings: '组织设置',
    nav_settings: '设置',
    // Theme
    theme_light: '浅色',
    theme_dark: '深色',
    theme_system: '跟随系统',
    // Lang
    lang_en: 'English',
    lang_zh: '中文',
    // Workspace switcher
    ws_personal: '个人',
    ws_create_org: '创建组织',
    ws_edit_profile: '编辑资料',
    ws_logout: '退出登录',
    ws_loading: '加载中...',
    // Login
    login_tagline: '项目管理',
    login_button: '登录',
    // Boards page
    boards_title: '看板列表',
    boards_new: '新建看板',
    boards_empty_title: '暂无看板',
    boards_empty_desc: '创建你的第一个看板开始工作。',
    // Board card
    boards_columns_one: '1 列',
    boards_columns_other: (n: number) => `${n} 列`,
    // Create board dialog
    create_board_title: '创建看板',
    create_board_name: '名称',
    create_board_desc: '描述（可选）',
    create_board_name_ph: '我的项目',
    create_board_desc_ph: '这个看板是用来做什么的？',
    create_board_submit: '创建看板',
    create_board_creating: '创建中...',
    create_board_success: '看板已创建',
    create_board_error: '创建看板失败',
    // Delete board dialog
    delete_board_title: '删除看板',
    delete_board_warning: '此操作不可撤销，看板内所有列和任务将被永久删除。',
    delete_board_confirm_prefix: '输入',
    delete_board_confirm_suffix: '以确认',
    delete_board_submit: '删除此看板',
    delete_board_deleting: '删除中...',
    delete_board_success: '看板已删除',
    delete_board_error: '删除看板失败',
    // Create org dialog
    create_org_btn: '新建组织',
    create_org_title: '创建组织',
    create_org_name_label: '组织名称',
    create_org_name_ph: 'Acme Corp',
    create_org_slug_label: 'URL 标识符',
    create_org_slug_ph: 'acme-corp',
    create_org_slug_taken: '该标识符已被占用，请换一个。',
    create_org_slug_available: '该标识符可用。',
    create_org_slug_hint: '用于 URL，创建后不可更改。',
    create_org_submit: '创建组织',
    create_org_creating: '创建中...',
    create_org_success: '组织已创建',
    create_org_error: '创建组织失败',
    create_org_slug_taken_toast: '该 URL 已被占用，请换一个',
    // Invite link card
    invite_title: '邀请成员',
    invite_generate: '生成邀请链接',
    invite_generating: '生成中...',
    invite_copied: '链接已复制！',
    invite_error: '生成邀请链接失败',
    // Kanban column
    column_add_ph: '请输入卡片标题…',
    column_add_card: '添加卡片',
    column_add_a_card: '添加卡片',
    column_create_error: '创建卡片失败',
    column_rename: '重命名',
    column_delete: '删除列',
    column_rename_error: '重命名列失败',
    column_delete_error: '删除列失败',
    // Kanban board filter
    board_filter: '筛选',
    board_labels: '标签',
    board_members: '成员',
    board_due_date: '截止日期',
    board_due_none: '无截止日期',
    board_due_overdue: '已逾期',
    board_due_today: '今天',
    board_due_upcoming: '即将到期',
    board_clear_filters: '清除所有筛选',
    board_add_column: '添加列',
    board_add_column_prompt: '列名称：',
    board_column_error: '添加列失败',
    board_column_pos_error: '保存列顺序失败',
    board_task_pos_error: '保存位置失败',
    // Board header
    board_base_folder: '基础目录',
    board_agent_tokens: 'Agent 令牌',
    board_base_folder_error: '保存基础目录失败',
    // Org settings page
    org_rename_section: '重命名',
    org_save: '保存',
    org_saving: '保存中...',
    org_members_section: '成员',
    org_danger_zone: '危险区域',
    org_delete_confirm: '删除此组织及其所有看板？此操作不可撤销。',
    org_delete_yes: '确认删除',
    org_cancel: '取消',
    org_delete_btn: '删除组织',
    org_deleting: '删除中...',
    org_rename_success: '组织已重命名',
    org_rename_error: '重命名组织失败',
    org_remove_member_success: '成员已移除',
    org_remove_member_error: '移除成员失败',
    org_delete_success: '组织已删除',
    org_delete_error: '删除组织失败',
    org_not_found: '未找到该组织。',
    // Profile page
    profile_title: '个人资料',
    profile_display_name: '显示名称',
    profile_save: '保存更改',
    profile_saving: '保存中...',
    profile_success: '资料已更新',
    profile_error: '更新资料失败',
    // Settings page
    settings_title: '设置',
    settings_qiniu_title: '七牛云存储',
    settings_qiniu_desc: '配置通过七牛 CDN 上传图片',
    settings_qiniu_success: '七牛设置已保存',
    settings_qiniu_error: '保存失败',
    settings_sentry_title: 'Sentry 配置',
    settings_sentry_desc: '监控各项目的错误',
    settings_sentry_add: '添加',
    settings_sentry_name_label: '配置名称（可选）',
    settings_sentry_org_label: '组织 slug',
    settings_sentry_token_label: 'Auth token',
    settings_sentry_fetch: '获取项目',
    settings_sentry_fetching: '获取中...',
    settings_sentry_cancel: '取消',
    settings_sentry_back: '← 返回',
    settings_sentry_select_label: '选择项目',
    settings_sentry_found: (n: number, org: string) => `在 ${org} 中找到 ${n} 个项目`,
    settings_sentry_save: '添加配置',
    settings_sentry_saving: '保存中...',
    settings_sentry_empty: '暂无 Sentry 配置。',
    settings_sentry_success: 'Sentry 配置已添加',
    settings_sentry_error: '添加配置失败',
    settings_sentry_delete_success: '已删除',
    settings_sentry_delete_error: '删除失败',
    settings_sentry_fetch_error: '获取项目失败',
    settings_token_title: 'API 令牌',
    settings_token_desc: '用于 CLI 和技能访问，令牌只显示一次。',
    settings_token_new_label: '新令牌（请立即复制，之后将不再显示）：',
    settings_token_copy: '复制',
    settings_token_ph: '令牌名称',
    settings_token_generate: '生成',
    settings_token_empty: '暂无令牌。',
    settings_token_copied: '已复制',
    settings_token_error: '创建令牌失败',
    settings_token_revoke_error: '操作失败',
    save: '保存',
  },
} as const

export type TranslationKey = keyof typeof translations.en

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key as string,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('opc_lang') as Lang | null
    if (saved === 'en' || saved === 'zh') setLangState(saved)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('opc_lang', l)
  }

  function t(key: TranslationKey): string {
    const val = translations[lang][key]
    if (typeof val === 'function') return key as string // function keys accessed directly
    return val as string
  }

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

/** Typed helper that also exposes function translations directly */
export function useT() {
  const { lang, t } = useI18n()
  const dict = translations[lang]
  return { t, lang, dict }
}
