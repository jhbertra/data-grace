import * as D from "./decoder";
import { Maybe } from "./maybe";

type Frequency = "SemiMonthly" | "Monthly";
type Salary = { frequency: Frequency, amount: number };
type Employee = {
    firstName: string,
    middleName: Maybe<string>,
    lastName: string,
    salaries: Array<[Date, Salary]>,
};

const salaryDecoder = D.liftO<Salary>({
    amount: D.property("amount", D.number),
    frequency: D.property("frequency", D.oneOf("SemiMonthly", "Monthly")),
});

const salaryRecordDecoder = D.tuple(D.date, D.object(salaryDecoder));

const employeeDecoder = D.liftO<Employee>({
    firstName: D.property("firstName", D.string),
    lastName: D.property("lastName", D.string),
    middleName: D.property("middleName", D.optional(D.string)),
    salaries: D.property("salaries", D.array(salaryRecordDecoder)),
});

const result = employeeDecoder.decode({
    firstName: "Bob",
    lastName: "Hawkins",
    middleName: "Micheal",
    salaries: [["2019-07-25", { amount: 100, frequency: "Monthly" }]],
});

// tslint:disable-next-line: no-console
console.log(result.toEither().mapLeft(JSON.stringify).map(JSON.stringify).toString());
