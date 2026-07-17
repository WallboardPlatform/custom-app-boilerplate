export type AnswerOption = 'A' | 'B' | 'C' | 'D';

export interface SafetyQuestion {
	correctOption: AnswerOption;
	explanation: string;
	options: Array<{ id: AnswerOption; label: string }>;
	prompt: string;
	questionId: string;
	sortOrder: number;
}

export interface SafetyAnswer {
	correct: boolean;
	questionId: string;
	selectedOption: AnswerOption;
}

export interface SafetySubmission {
	answersJson: string;
	completedAt: string;
	corporateId: string;
	participantName: string;
	score: number;
	submissionId: string;
	totalQuestions: number;
}
