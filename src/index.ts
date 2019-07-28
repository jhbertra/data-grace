import { Maybe } from "./maybe";
import * as D from "./decoder";

type Frequency = "SemiMonthly" | "Monthly";
type Salary = { frequency: Frequency, amount: number };
type Employee = {
    firstName: string,
    middleName: Maybe<string>,
    lastName: string,
    salaries: [Date, Salary][]
}

const salaryDecoder = D.liftO<Salary>({
    frequency: D.property("frequency", D.oneOf("SemiMonthly", "Monthly")),
    amount: D.property("amount", D.number)
});

const salaryRecordDecoder = D.tuple(D.date, D.object(salaryDecoder));

const employeeDecoder = D.liftO<Employee>({
    firstName: D.property("firstName", D.string),
    middleName: D.property("middleName", D.optional(D.string)),
    lastName: D.property("lastName", D.string),
    salaries: D.property("salaries", D.array(salaryRecordDecoder))
});

const result = employeeDecoder.decode({
    firstName: "Bob",
    middleName: "Micheal",
    lastName: "Hawkins",
    salaries: [["2019-07-25", { amount: 100, frequency: "Monthly" }]]
});

console.log(result.toEither().mapLeft(JSON.stringify).map(JSON.stringify).toString());